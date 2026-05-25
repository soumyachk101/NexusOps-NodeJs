
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  name: 'name',
  avatar_url: 'avatar_url',
  github_id: 'github_id',
  github_username: 'github_username',
  github_access_token: 'github_access_token',
  google_id: 'google_id',
  google_access_token: 'google_access_token',
  hashed_password: 'hashed_password',
  provider: 'provider',
  is_active: 'is_active',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.WorkspaceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  slug: 'slug',
  description: 'description',
  owner_id: 'owner_id',
  telegram_chat_id: 'telegram_chat_id',
  jira_project_key: 'jira_project_key',
  jira_base_url: 'jira_base_url',
  default_branch: 'default_branch',
  auto_revert_enabled: 'auto_revert_enabled',
  error_rate_threshold: 'error_rate_threshold',
  revert_window_min: 'revert_window_min',
  notify_telegram_chat_id: 'notify_telegram_chat_id',
  notify_on_pr: 'notify_on_pr',
  notify_on_revert: 'notify_on_revert',
  notify_on_task: 'notify_on_task',
  slack_webhook_url: 'slack_webhook_url',
  slack_bot_token: 'slack_bot_token',
  slack_channel_id: 'slack_channel_id',
  ollama_base_url: 'ollama_base_url',
  otel_endpoint: 'otel_endpoint',
  otel_service_name: 'otel_service_name',
  settings: 'settings',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.WorkspaceMemberScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  user_id: 'user_id',
  role: 'role',
  joined_at: 'joined_at'
};

exports.Prisma.SourceScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  source_type: 'source_type',
  name: 'name',
  status: 'status',
  file_url: 'file_url',
  file_size_bytes: 'file_size_bytes',
  duration_seconds: 'duration_seconds',
  external_id: 'external_id',
  metadata: 'metadata',
  error_message: 'error_message',
  processed_at: 'processed_at',
  created_at: 'created_at'
};

exports.Prisma.DocumentChunkScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  source_id: 'source_id',
  chunk_index: 'chunk_index',
  text: 'text',
  metadata: 'metadata',
  sender: 'sender',
  timestamp: 'timestamp',
  source_type: 'source_type',
  channel_name: 'channel_name',
  incident_id: 'incident_id',
  relevance_score: 'relevance_score',
  access_count: 'access_count',
  last_accessed_at: 'last_accessed_at',
  decay_factor: 'decay_factor',
  created_at: 'created_at'
};

exports.Prisma.QueryHistoryScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  user_id: 'user_id',
  question: 'question',
  answer: 'answer',
  sources: 'sources',
  latency_ms: 'latency_ms',
  model_used: 'model_used',
  feedback: 'feedback',
  created_at: 'created_at'
};

exports.Prisma.TaskScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  assignee_hint: 'assignee_hint',
  deadline_hint: 'deadline_hint',
  source_chunk_id: 'source_chunk_id',
  source_preview: 'source_preview',
  jira_ticket_key: 'jira_ticket_key',
  jira_synced_at: 'jira_synced_at',
  detected_at: 'detected_at',
  updated_at: 'updated_at'
};

exports.Prisma.ProblemScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  title: 'title',
  description: 'description',
  frequency: 'frequency',
  severity: 'severity',
  status: 'status',
  first_seen: 'first_seen',
  last_seen: 'last_seen',
  related_chunk_ids: 'related_chunk_ids',
  created_at: 'created_at'
};

exports.Prisma.RepositoryScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  github_repo_id: 'github_repo_id',
  full_name: 'full_name',
  name: 'name',
  default_branch: 'default_branch',
  branch: 'branch',
  provider: 'provider',
  language: 'language',
  is_private: 'is_private',
  webhook_id: 'webhook_id',
  github_token: 'github_token',
  last_synced_at: 'last_synced_at',
  created_at: 'created_at'
};

exports.Prisma.IncidentScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  repository_id: 'repository_id',
  raw_error: 'raw_error',
  raw_stack_trace: 'raw_stack_trace',
  sanitized_error: 'sanitized_error',
  sanitized_stack_trace: 'sanitized_stack_trace',
  sanitization_report: 'sanitization_report',
  error_type: 'error_type',
  error_message: 'error_message',
  stack_trace: 'stack_trace',
  severity: 'severity',
  environment: 'environment',
  branch: 'branch',
  source: 'source',
  external_id: 'external_id',
  root_cause: 'root_cause',
  affected_files: 'affected_files',
  analysis_confidence: 'analysis_confidence',
  analysis_keywords: 'analysis_keywords',
  confidence_score: 'confidence_score',
  trace_id: 'trace_id',
  memory_context: 'memory_context',
  pr_url: 'pr_url',
  pr_number: 'pr_number',
  pr_branch: 'pr_branch',
  pr_created_at: 'pr_created_at',
  pr_merged_at: 'pr_merged_at',
  status: 'status',
  pipeline_error: 'pipeline_error',
  received_at: 'received_at',
  resolved_at: 'resolved_at',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.FixScalarFieldEnum = {
  id: 'id',
  incident_id: 'incident_id',
  title: 'title',
  explanation: 'explanation',
  diff: 'diff',
  confidence: 'confidence',
  caveats: 'caveats',
  file_changes: 'file_changes',
  safety_score: 'safety_score',
  safety_issues: 'safety_issues',
  reviewed_by: 'reviewed_by',
  reviewed_at: 'reviewed_at',
  review_note: 'review_note',
  model_used: 'model_used',
  prompt_tokens: 'prompt_tokens',
  completion_tokens: 'completion_tokens',
  status: 'status',
  pr_url: 'pr_url',
  created_at: 'created_at'
};

exports.Prisma.RevertEventScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  incident_id: 'incident_id',
  trigger_type: 'trigger_type',
  reason: 'reason',
  bad_deploy_id: 'bad_deploy_id',
  reverted_to: 'reverted_to',
  platform: 'platform',
  status: 'status',
  error_message: 'error_message',
  triggered_at: 'triggered_at',
  completed_at: 'completed_at'
};

exports.Prisma.ErrorRateSnapshotScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  rate: 'rate',
  deploy_id: 'deploy_id',
  recorded_at: 'recorded_at'
};

exports.Prisma.ActivityLogScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  user_id: 'user_id',
  module: 'module',
  action: 'action',
  resource_type: 'resource_type',
  resource_id: 'resource_id',
  metadata: 'metadata',
  created_at: 'created_at'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  channel: 'channel',
  event_type: 'event_type',
  title: 'title',
  body: 'body',
  resource_type: 'resource_type',
  resource_id: 'resource_id',
  status: 'status',
  error_message: 'error_message',
  sent_at: 'sent_at',
  created_at: 'created_at'
};

exports.Prisma.PostMortemScalarFieldEnum = {
  id: 'id',
  workspace_id: 'workspace_id',
  incident_id: 'incident_id',
  title: 'title',
  summary: 'summary',
  root_cause: 'root_cause',
  timeline: 'timeline',
  impact: 'impact',
  remediation: 'remediation',
  prevention: 'prevention',
  pdf_url: 'pdf_url',
  generated_at: 'generated_at',
  created_at: 'created_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};


exports.Prisma.ModelName = {
  User: 'User',
  Workspace: 'Workspace',
  WorkspaceMember: 'WorkspaceMember',
  Source: 'Source',
  DocumentChunk: 'DocumentChunk',
  QueryHistory: 'QueryHistory',
  Task: 'Task',
  Problem: 'Problem',
  Repository: 'Repository',
  Incident: 'Incident',
  Fix: 'Fix',
  RevertEvent: 'RevertEvent',
  ErrorRateSnapshot: 'ErrorRateSnapshot',
  ActivityLog: 'ActivityLog',
  Notification: 'Notification',
  PostMortem: 'PostMortem'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
