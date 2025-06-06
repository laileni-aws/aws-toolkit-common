﻿using System;

namespace Amazon.AwsToolkit.Telemetry.Events.Core
{
    /// <summary>
    /// Parent to all classes representing events to be recorded
    /// </summary>
    public abstract class BaseTelemetryEvent
    {
        /// <summary>
        /// Indicates if the metric relates to something the user has initiated (false)
        /// or something the Toolkit may have automatically induced (true).
        /// 
        /// Derived classes configure this value to match the telemetry definitions.
        /// Most metrics are intended to be passive or active, but some can be both,
        /// this property gives calling code the opportunity to adjust if needed.
        /// </summary>
        public bool Passive = false;

        /// <summary>
        /// Indicates if the metric should track run-time performance information (true)
        /// or not (false).
        ///
        /// Derived classes configure this value to match the telemetry definitions.
        /// </summary>
        public bool TrackPerformance = false;

        /// <summary>
        /// Optional - Reason code or name for an event (when <see cref="Result"/>=Succeeded) or error (when <see cref="Result"/>=Failed).
        /// Unlike the <see cref="ReasonDesc"/> field, this should be a stable/predictable name for
        /// a class of events or errors (typically the exception name, e.g. FileIOException).
        /// </summary>
        public string Reason;

        /// <summary>
        /// Optional - Error message detail. May contain arbitrary message details (unlike the <see cref="Reason"/> field),
        /// but should be truncated (recommendation: 200 chars).
        /// </summary>
        public string ReasonDescription;

        /// <summary>
        /// The source of the operation. This answers 'who' caused/triggered the operation.
        /// Example: did an Auth signout happen because of some expiration or since the user
        /// explicitly clicked the signout button.
        /// </summary>
        public string Source;

        /// <summary>
        /// Optional - User-friendly error codes describing a failed operation
        /// This is often used in failure scenarios to provide additional details about why something failed.
        /// </summary>
        public string ErrorCode;

        /// <summary>
        /// Optional - High level categorization indicating the cause of the error eg. client, user, service, unknown
        /// This is often used in failure scenarios to provide additional details about why something failed.
        /// </summary>
        public string CausedBy;

        /// <summary>
        /// Optional - Describes the HTTP status code for request made. The semantics are contextual based off of other fields (e.g. `requestId`)
        /// This is often used in failure scenarios to provide additional details about why something failed.
        /// </summary>
        public string HttpStatusCode;

        /// <summary>
        /// Optional - A generic request ID field. The semantics are contextual based off of other fields (e.g. `requestServiceType`). For example, an event with `requestServiceType: s3` means that the request ID is associated with an S3 API call. Events that cover mutliple API calls should use the request ID of the most recent call.
        /// This is often used in failure scenarios to provide additional details about why something failed.
        /// </summary>
        public string RequestId;

        /// <summary>
        /// Optional - A unique identifier for the trace (a set of events) this metric belongs to
        /// </summary>
        public string TraceId;
        
        /// <summary>
        /// Optional - A unique identifier for this metric
        /// </summary>
        public string MetricId;
        
        /// <summary>
        /// Optional - A unique identifier of this metrics parent metric id
        /// </summary>
        public string ParentId;
        
        /// <summary>
        /// Optional - Per-request service identifier. Unlike `serviceType` (which describes the originator of the request), this describes the request itself.
        /// This is often used in failure scenarios to provide additional details about why something failed.
        /// </summary>
        public string RequestServiceType;
        
        /// <summary>
        /// Optional - The duration for the workflow associated with the metric 
        /// This is often used in multi-step workflows to provide additional details about how long did the action take
        /// </summary>
        public double? Duration;

        /// <summary>
        /// Optional - Language-related user preference information. Examples: en-US, en-GB, etc.
        /// </summary>
        public string Locale;

        public DateTime? CreatedOn;
        public double? Value;
        public string AwsAccount;
        public string AwsRegion;
    }
}
