/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    Scope,
    Project,
    StructureKind,
    InterfaceDeclarationStructure,
    PropertySignatureStructure,
    TypeAliasDeclarationStructure,
    ClassDeclarationStructure,
    MethodDeclarationStructure,
    VariableStatementStructure,
    VariableDeclarationKind,
} from 'ts-morph'
import { readFile, readFileSync, writeFile } from 'fs-extra'
import _ = require('lodash')
import { Options as prettierOptions } from 'prettier'
// Using 'prettier/standalone' as a workaround since prettier v3 moved to ESM modules.
import * as prettier from 'prettier/standalone'
import * as parserTypeScript from 'prettier/plugins/typescript'
import * as parserEstree from 'prettier/plugins/estree'
import {
    MetadataType,
    MetricMetadataType,
    Metric,
    MetricDefinitionRoot,
    CommandLineArguments,
    validateInput,
} from './parser'

function toTitleCase(s: string): string {
    return s.replace(s[0], s[0].toUpperCase())
}

function snakeCaseToPascalCase(s: string): string {
    return s.split('_').map(toTitleCase).join('')
}

// converts snake_case to PascalCase. E.x. lambda_invoke => LambdaInvoke
function metricToTypeName(m: Metric): string {
    return snakeCaseToPascalCase(m.name)
}

export async function generate(args: CommandLineArguments) {
    const rawDefinitions: MetricDefinitionRoot = args.inputFiles
        .map(path => {
            const fileInput = readFileSync(path, 'utf8')
            return validateInput(fileInput, path)
        })
        .reduce(
            (item: MetricDefinitionRoot, input: MetricDefinitionRoot) => {
                item.types?.push(...(input.types ?? []))
                item.metrics.push(...input.metrics)
                return item
            },
            { types: [], metrics: [] }
        )
    // Allow read in files to overwrite default definitions. First one wins, so the extra
    // files are read before the default resources (above)
    const input = {
        types: _.uniqBy(rawDefinitions.types, 'name'),
        metrics: _.uniqBy(rawDefinitions.metrics, 'name'),
    }

    const output = generateFile(input, args.outputFile)
    const options: prettierOptions = JSON.parse(await readFile(`${__dirname}/../.prettierrc`, 'utf-8'))
    options.parser = 'typescript'
    // Because we use 'prettier/standalone', we need to explicitly pass the plugins.
    options.plugins = [parserTypeScript, parserEstree]
    const formattedOutput = await prettier.format(output.getFullText(), options)
    await writeFile(output.getFilePath(), formattedOutput)

    console.log('Done generating!')
}

const exportedTypes: TypeAliasDeclarationStructure[] = []

function getArgsFromMetadata(m: MetadataType): string {
    if (m.allowedValues) {
        const name = toTitleCase(m.name)
        const mm = exportedTypes.find(tt => tt.name === name)

        if (!mm) {
            exportedTypes.push({
                name,
                kind: StructureKind.TypeAlias,
                isExported: true,
                type: m.allowedValues.map(v => `'${v}'`).join(' | '),
            })
        }

        return name
    }

    switch (m.type) {
        case undefined:
        case 'string':
            return 'string'
        case 'double':
        case 'int':
            return 'number'
        case 'boolean':
            return 'boolean'
        default: {
            throw new TypeError(`unknown type ${m?.type} in metadata ${m.name}`)
        }
    }
}

function getTypeOrThrow(types: MetadataType[] = [], name: string) {
    const type = types.find(t => t.name === name)

    if (!type) {
        throw new Error(`did not find type: ${name}`)
    }

    return type
}

const baseName = 'MetricBase'

/**
 * Fields set automatically by the telemetry client (thus application code
 * normally shouldn't set these because the value will be overridden).
 */
const commonMetadata = [
    'awsAccount',
    'awsRegion',
    'duration',
    'httpStatusCode',
    'reason',
    'reasonDesc',
    'requestId',
    'requestServiceType',
    'result',
    'source',
] as const

/**
 * These fields will also be set by the telemetry client, but the caller might
 * know better, so they won't be overridden if specified in `.record()` calls.
 */
const optionalMetadata: typeof commonMetadata[number][] = ['awsRegion']

const passive: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'passive',
    type: 'boolean',
    docs: ['A flag indicating that the metric was not caused by the user.'],
    kind: StructureKind.PropertySignature,
}

const trackPerformance: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'trackPerformance',
    type: 'boolean',
    docs: ['A flag indicating that the metric should track run-time performance information'],
    kind: StructureKind.PropertySignature,
}

const traceId: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'traceId',
    type: 'string',
    docs: ['Unique identifier for the trace (a set of events) this metric belongs to'],
    kind: StructureKind.PropertySignature,
}

const metricId: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'metricId',
    type: 'string',
    docs: ['Unique identifier for this metric'],
    kind: StructureKind.PropertySignature,
}

const parentId: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'parentId',
    type: 'string',
    docs: ['Unique identifier of the parent of this metric'],
    kind: StructureKind.PropertySignature,
}

const value: PropertySignatureStructure = {
    isReadonly: true,
    hasQuestionToken: true,
    name: 'value',
    type: 'number',
    docs: ['@deprecated Arbitrary "value" of the metric.'],
    kind: StructureKind.PropertySignature,
}

const runtimeMetricDefinition: InterfaceDeclarationStructure = {
    name: 'MetricDefinition',
    kind: StructureKind.Interface,
    isExported: true,
    properties: [
        {
            name: 'unit',
            type: 'string',
            isReadonly: true,
        },
        {
            name: 'passive',
            type: 'boolean',
            isReadonly: true,
        },
        {
            name: 'trackPerformance',
            type: 'boolean',
            isReadonly: true,
        },
        {
            name: 'requiredMetadata',
            type: 'readonly string[]',
            isReadonly: true,
        }
    ]
}

const header = `
/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
`.trimStart()

function getMetricMetadata(metric: Metric) {
    return metric.metadata?.filter(m => !commonMetadata.includes(m.type as typeof commonMetadata[number])) ?? []
}

function generateMetadataProperty(metadata: MetricMetadataType): PropertySignatureStructure {
    return {
        isReadonly: true,
        name: metadata.name,
        docs: [metadata.description],
        kind: StructureKind.PropertySignature,
        type: getArgsFromMetadata(metadata),
        hasQuestionToken: !metadata.required,
    }
}

function generateMetricBase(types: MetadataType[] | undefined): InterfaceDeclarationStructure {
    const toProp = (name: string) => generateMetadataProperty({ required: false, ...getTypeOrThrow(types, name) })

    return {
        name: baseName,
        isExported: true,
        kind: StructureKind.Interface,
        properties: commonMetadata.map(toProp).concat(passive, value, trackPerformance, traceId, metricId, parentId),
    }
}

function generateMetricInterface(metric: Metric, types: MetadataType[] | undefined): InterfaceDeclarationStructure {
    return {
        name: metricToTypeName(metric),
        kind: StructureKind.Interface,
        extends: [baseName],
        isExported: true,
        properties: getMetricMetadata(metric).map(m => {
            return generateMetadataProperty({ ...getTypeOrThrow(types, m.type), required: m.required ?? true })
        }),
    }
}

function generateMetricRecorder(metadataType: TypeAliasDeclarationStructure): InterfaceDeclarationStructure {
    return {
        name: 'Metric',
        isExported: true,
        typeParameters: [`T extends ${baseName} = ${baseName}`],
        properties: [
            {
                name: 'name',
                type: 'string',
                isReadonly: true,
            }
        ],
        methods: [
            {
                docs: ['Sends the metric to the telemetry service'],
                name: 'emit',
                returnType: 'void',
                parameters: [{
                        name: 'data',
                        type: 'T',
                        hasQuestionToken: true,
                }],
            },
            {
                docs: ['Executes a callback, automatically sending the metric after completion'],
                name: 'run',
                typeParameters: ['U'],
                returnType: 'U',
                parameters: [{
                        name: 'fn',
                        type: `(span: Span<T>) => U`,
                }],
            }
        ],
        kind: StructureKind.Interface,
    }
}

function generateTelemetryHelper(recorder: InterfaceDeclarationStructure, metrics: Metric[]): ClassDeclarationStructure {
    const getMetric: MethodDeclarationStructure = {
        name: 'getMetric',
        scope: Scope.Protected,
        kind: StructureKind.Method,
        parameters: [{ name: 'name', type: 'string' }],
        returnType: recorder.name,
        isAbstract: true,
    }

    return {
        name: 'TelemetryBase',
        kind: StructureKind.Class,
        isAbstract: true,
        methods: [getMetric],
        getAccessors: metrics.map(m => {
            return {
                scope: Scope.Public,
                name: m.name,
                docs: [m.description],
                returnType: `${recorder.name}<${metricToTypeName(m)}>`,
                statements: `return this.${getMetric.name}('${m.name}')`,
            }
        }),
        isExported: true,
    }
}

function generateMetricShapeMap(metrics: Metric[]): InterfaceDeclarationStructure {
    return {
        name: 'MetricShapes',
        kind: StructureKind.Interface,
        isExported: true,
        properties: metrics.map(m => {
            return {
                isReadonly: true,
                name: `'${m.name}'`,
                type: metricToTypeName(m),
            }
        }),
    }
}

function generateDefinitions(metrics: Metric[]): VariableStatementStructure {
    const fields = metrics.map(m => {
        const metadataTypes = getMetricMetadata(m).filter(m => m.required ?? true).map(m => `'${m.type}'`)
        const requiredMetadata = `[${metadataTypes.join(', ')}]`

        return `${m.name}: { unit: '${m.unit ?? 'None'}', passive: ${m.passive ?? false}, trackPerformance: ${m.trackPerformance ?? false}, requiredMetadata: ${requiredMetadata} }`
    })

    return {
        isExported: true,
        declarations: [{
                name: 'definitions',
                type: `Record<string, ${runtimeMetricDefinition.name}>`,
                initializer: `{ ${fields.join(',\n')} }`,
        }],
        declarationKind: VariableDeclarationKind.Const,
        kind: StructureKind.VariableStatement,
    }
}

function generateFile(telemetryJson: MetricDefinitionRoot, dest: string) {
    const project = new Project({})
    const file = project.createSourceFile(dest, header, { overwrite: true })

    file.addInterface(generateMetricBase(telemetryJson.types))
    file.addInterfaces(telemetryJson.metrics.map(m => generateMetricInterface(m, telemetryJson.types)))
    file.addTypeAliases(exportedTypes)
    file.addInterface(runtimeMetricDefinition)

    const metricsMap = generateMetricShapeMap(telemetryJson.metrics)
    file.addInterface(metricsMap)
    file.addTypeAlias({
        isExported: true,
        name: 'MetricName',
        type: `keyof ${metricsMap.name}`,
    })

    const metadataType: TypeAliasDeclarationStructure = {
        isExported: true,
        name: 'Metadata',
        typeParameters: [`T extends ${baseName}`],
        type: `Partial<Omit<T, keyof ${baseName}> | Partial<Pick<${baseName}, ${optionalMetadata.map(v => `'${v}'`).join(' | ')}>>>`,
        kind: StructureKind.TypeAlias,
    }

    const span: InterfaceDeclarationStructure = {
        kind: StructureKind.Interface,
        name: 'Span',
        isExported: true,
        typeParameters: [{ name: 'T' }],
        docs: ['Represents a telemetry span for tracking and recording metric data.'],
        methods: [
            {
                name: 'record',
                parameters: [
                    {
                        name: 'data',
                        type: 'Partial<T>',
                    },
                ],
                returnType: 'this',
            }
        ],
    }

    const definitions = generateDefinitions(telemetryJson.metrics)
    const recorder = generateMetricRecorder(metadataType)
    file.addVariableStatement(definitions)
    file.addTypeAlias(metadataType)
    file.addInterface(span)
    file.addInterface(recorder)
    file.addClass(generateTelemetryHelper(recorder, telemetryJson.metrics))

    return file
}
