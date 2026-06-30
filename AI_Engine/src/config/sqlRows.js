// lowercase -> canonical column name, derived from deploy/postgres/schema.sql.
// Conflicting names (id/createdat/updatedat) resolve to the PascalCase form
// used by 11 of 12 tables; AppConfigurations never reads those columns off the
// row, so this is safe.
const COLUMN_NAME_MAP = {
  id: 'Id',
  userid: 'UserId',
  featurename: 'FeatureName',
  usagecount: 'UsageCount',
  lastused: 'LastUsed',
  createdat: 'CreatedAt',
  querytext: 'QueryText',
  responsetext: 'ResponseText',
  operationtype: 'OperationType',
  appname: 'appName',
  adminemail: 'adminEmail',
  geminiapikey: 'geminiApiKey',
  geminimodel: 'geminiModel',
  temperature: 'temperature',
  pineconeapikey: 'pineconeApiKey',
  pineconeindex: 'pineconeIndex',
  updatedat: 'UpdatedAt',
  filename: 'FileName',
  originalfilename: 'OriginalFileName',
  filepath: 'FilePath',
  uploadedat: 'UploadedAt',
  analysisat: 'AnalysisAt',
  riskscore: 'RiskScore',
  confidence: 'Confidence',
  analysisjson: 'AnalysisJson',
  analysistext: 'AnalysisText',
  aimodel: 'AIModel',
  durationms: 'DurationMs',
  isfinal: 'IsFinal',
  recordtype: 'RecordType',
  title: 'Title',
  folder: 'Folder',
  status: 'Status',
  deletedat: 'DeletedAt',
  contracttext: 'ContractText',
  description: 'Description',
  name: 'Name',
  email: 'Email',
  type: 'Type',
  rating: 'Rating',
  content: 'Content',
  replycontent: 'ReplyContent',
  fullname: 'FullName',
  phone: 'Phone',
  specialty: 'Specialty',
  isactive: 'IsActive',
  documentnumber: 'DocumentNumber',
  issueyear: 'IssueYear',
  category: 'Category',
  sourceurl: 'SourceUrl',
  syncstatusssms: 'SyncStatusSsms',
  syncstatuspinecone: 'SyncStatusPinecone',
  agency: 'Agency',
  issuedatestring: 'IssueDateString',
  isautocrawlon: 'IsAutoCrawlOn',
  crawltime: 'CrawlTime',
  targeturls: 'TargetUrls',
  dailylimit: 'DailyLimit',
  filterpatterns: 'FilterPatterns',
  documentid: 'DocumentId',
  documenttitle: 'DocumentTitle',
  viewedat: 'ViewedAt',
  password: 'Password',
  role: 'Role',
  resetpin: 'ResetPin',
  resetpinexpires: 'ResetPinExpires',
  googleid: 'GoogleId',
  avatar: 'Avatar',
  authprovider: 'AuthProvider',
  savedat: 'SavedAt',
  videourl: 'VideoUrl',
  platform: 'Platform',
  transcript: 'Transcript',
  summary: 'Summary',
  legalbases: 'LegalBases',
  trustscore: 'TrustScore',
  lastaccessedat: 'LastAccessedAt',
  accesscount: 'AccessCount',
};

function shapeRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[COLUMN_NAME_MAP[key] || key] = value;
  }
  return new Proxy(out, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        const lower = prop.toLowerCase();
        for (const key of Object.keys(target)) {
          if (key.toLowerCase() === lower) return target[key];
        }
      }
      return target[prop];
    },
  });
}

module.exports = { COLUMN_NAME_MAP, shapeRow };
