import React, { useEffect, useMemo, useState, type FormEvent } from 'react';

type Account = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
};

type Scheme = {
  id: string;
  title: string;
  ministry: string;
  amount: string;
  category: string;
  deadline: string;
  description: string;
  requiredDocuments: string[];
  eligibility: EligibilityCriteria;
};

type EligibilityCriteria = {
  eligibleStates: string[];
  eligibleCaste: string[];
  minIncome?: number;
  maxIncome?: number;
  minAge?: number;
  maxAge?: number;
  eligibleGenders?: string[];
  eligibleOccupations?: string[];
  eligibleEducationLevels?: string[];
};

type ApplicationRecord = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  personalInfo: Omit<AppFormData, 'declarationAccepted'>;
  eligibilityInputs: CalcData;
  schemeId: string;
  schemeTitle: string;
  schemeDescription: string;
  appliedDate: string;
  submittedAt: string;
  lastUpdated: string;
  amount: string;
  status: string;
  stage: number;
  documents: ApplicationDocument[];
};

type ApplicationDocument = {
  name: string;
  url: string;
  type?: string;
  documentType?: string;
};

type AppFormData = {
  fullName: string;
  tribeName: string;
  casteCertNo: string;
  instituteName: string;
  courseName: string;
  bankAccNo: string;
  ifscCode: string;
  declarationAccepted: boolean;
};

type CalcData = {
  income: string;
  state: string;
  caste: string;
  gender: string;
  occupation: string;
  age: string;
  education: string;
};

type EligibilityResult = Scheme & {
  isEligible: boolean;
  reasons: string[];
  matchPercentage: number;
};

type AccessMode = 'PUBLIC' | 'RESTRICTED';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const CASTES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const GENDERS = ['Male', 'Female', 'Other'];
const OCCUPATIONS = ['Student', 'Farmer', 'Disabled', 'Senior Citizen', 'Minority', 'Entrepreneur'];
const EDUCATION_LEVELS = ['School', 'Undergraduate', 'Postgraduate', 'M.Phil', 'Ph.D.'];
const REQUIRED_UPLOADS = [
  { key: 'casteCertificate', label: 'Caste / Tribe Certificate' },
  { key: 'incomeCertificate', label: 'Income Certificate' },
  { key: 'identityProof', label: 'Aadhaar Card / ID Proof' },
  { key: 'bankProof', label: 'Bank Passbook / Account Proof' },
  { key: 'instituteProof', label: 'Institute Bonafide / Admission Proof' },
  { key: 'photo', label: 'Passport-size Photo' }
];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ACCEPTED_UPLOAD_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function checkSchemeEligibility(scheme: Scheme, data: CalcData): { isEligible: boolean; reasons: string[] } {
  const criteria = scheme.eligibility;
  const income = Number(data.income);
  const age = Number(data.age);
  const reasons: string[] = [];

  if (criteria.eligibleStates.length > 0 && !criteria.eligibleStates.includes(data.state)) {
    reasons.push('Not applicable in your state');
  }
  if (criteria.eligibleCaste.length > 0 && !criteria.eligibleCaste.includes(data.caste)) {
    reasons.push('Caste/category is not eligible');
  }
  if (criteria.minIncome !== undefined && income < criteria.minIncome) {
    reasons.push(`Income below minimum (Min: ₹${criteria.minIncome.toLocaleString()})`);
  }
  if (criteria.maxIncome !== undefined && income > criteria.maxIncome) {
    reasons.push(`Income exceeds limit (Max: ₹${criteria.maxIncome.toLocaleString()})`);
  }
  if (criteria.minAge !== undefined && age < criteria.minAge) {
    reasons.push(`Age below minimum (Min: ${criteria.minAge})`);
  }
  if (criteria.maxAge !== undefined && age > criteria.maxAge) {
    reasons.push(`Age above maximum (Max: ${criteria.maxAge})`);
  }
  if (criteria.eligibleGenders && !criteria.eligibleGenders.includes(data.gender)) {
    reasons.push('Gender is not eligible for this scheme');
  }
  if (criteria.eligibleOccupations && !criteria.eligibleOccupations.includes(data.occupation)) {
    reasons.push('Occupation/category is not eligible');
  }
  if (criteria.eligibleEducationLevels && !criteria.eligibleEducationLevels.includes(data.education)) {
    reasons.push('Education level does not match');
  }

  return { isEligible: reasons.length === 0, reasons };
}

function ApplicationDetailModal({
  application,
  onClose
}: {
  application: ApplicationRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatTimestamp = (value: string) => new Date(value).toLocaleString();
  const personalFields = [
    ['Full name', application.personalInfo.fullName],
    ['Email', application.applicantEmail],
    ['Tribe name', application.personalInfo.tribeName],
    ['Caste certificate', application.personalInfo.casteCertNo],
    ['Institute', application.personalInfo.instituteName],
    ['Course', application.personalInfo.courseName],
    ['Bank account', application.personalInfo.bankAccNo],
    ['IFSC code', application.personalInfo.ifscCode]
  ];
  const eligibilityFields = [
    ['Annual income', `₹${Number(application.eligibilityInputs.income).toLocaleString()}`],
    ['State', application.eligibilityInputs.state],
    ['Caste / category', application.eligibilityInputs.caste],
    ['Gender', application.eligibilityInputs.gender],
    ['Occupation', application.eligibilityInputs.occupation],
    ['Age', application.eligibilityInputs.age],
    ['Education', application.eligibilityInputs.education]
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-detail-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono font-bold text-amber-400">{application.id}</div>
            <h2 id="application-detail-title" className="text-xl font-bold text-white mt-1">Application details</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close application details"
            className="text-2xl leading-none text-slate-400 hover:text-white px-2"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-amber-400 mb-3">Applicant information</h3>
            <div className="space-y-2">
              {personalFields.map(([label, value]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-slate-800 pb-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white sm:text-right break-words">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-amber-400 mb-3">Submitted eligibility inputs</h3>
            <div className="space-y-2">
              {eligibilityFields.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-slate-800 pb-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5 space-y-3 text-xs">
          <h3 className="text-sm font-bold text-amber-400">Scheme</h3>
          <div className="font-bold text-white">{application.schemeTitle}</div>
          <div className="text-slate-400">Scheme ID: <span className="text-white">{application.schemeId}</span></div>
          <p className="text-slate-400 leading-relaxed">{application.schemeDescription}</p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-400 block">Status</span><strong className="text-white">{application.status}</strong></div>
          <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-400 block">Stage</span><strong className="text-white">{application.stage} / 4</strong></div>
          <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-400 block">Amount</span><strong className="text-white">{application.amount}</strong></div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-400">
          <div>Application date: <span className="text-white">{application.appliedDate}</span></div>
          <div>Submitted: <span className="text-white">{formatTimestamp(application.submittedAt)}</span></div>
          <div>Last updated: <span className="text-white">{formatTimestamp(application.lastUpdated)}</span></div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-sm font-bold text-amber-400 mb-3">Documents</h3>
          {application.documents.length > 0 ? (
            <div className="space-y-2 text-xs">
              {application.documents.map((document) => (
                <div key={`${document.documentType || 'document'}-${document.name}`} className="flex items-center gap-3">
                  {document.type?.startsWith('image/') && (
                    <img src={document.url} alt={document.documentType || document.name} className="h-12 w-12 rounded object-cover border border-slate-700" />
                  )}
                  <a href={document.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline break-all">
                    {document.documentType ? `${document.documentType}: ` : ''}{document.name}{document.type ? ` (${document.type})` : ''}
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No documents uploaded.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function SchemeDetailModal({
  scheme,
  onClose
}: {
  scheme: Scheme;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const criteria = [
    ['Income limit', `${scheme.eligibility.minIncome !== undefined ? `₹${scheme.eligibility.minIncome.toLocaleString()} minimum` : ''}${scheme.eligibility.minIncome !== undefined && scheme.eligibility.maxIncome !== undefined ? ' - ' : ''}${scheme.eligibility.maxIncome !== undefined ? `₹${scheme.eligibility.maxIncome.toLocaleString()} maximum` : 'No limit specified'}`],
    ['States', scheme.eligibility.eligibleStates.length > 0 ? scheme.eligibility.eligibleStates.join(', ') : 'All states'],
    ['Caste / category', scheme.eligibility.eligibleCaste.length > 0 ? scheme.eligibility.eligibleCaste.join(', ') : 'All categories'],
    ['Age range', `${scheme.eligibility.minAge ?? 'No minimum'} - ${scheme.eligibility.maxAge ?? 'No maximum'}`],
    ['Gender', scheme.eligibility.eligibleGenders?.join(', ') || 'All genders'],
    ['Occupation', scheme.eligibility.eligibleOccupations?.join(', ') || 'All occupations'],
    ['Education', scheme.eligibility.eligibleEducationLevels?.join(', ') || 'All education levels']
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="scheme-detail-title"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-mono font-bold text-amber-400">{scheme.id}</div>
            <h2 id="scheme-detail-title" className="text-xl font-bold text-white mt-1">{scheme.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close scheme details" className="text-2xl leading-none text-slate-400 hover:text-white px-2">
            ×
          </button>
        </div>

        <div className="space-y-6 text-xs">
          <div>
            <h3 className="text-sm font-bold text-amber-400 mb-2">Overview</h3>
            <p className="text-slate-300 leading-relaxed">{scheme.description}</p>
            <p className="text-slate-400 mt-2">Ministry: <span className="text-white">{scheme.ministry}</span></p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-400 block">Benefits / amount</span><strong className="text-emerald-400">{scheme.amount}</strong></div>
            <div className="bg-slate-950 rounded-xl p-3"><span className="text-slate-400 block">Application deadline</span><strong className="text-white">{scheme.deadline || 'Not specified'}</strong></div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-amber-400 mb-3">Eligibility criteria</h3>
            <div className="space-y-2">
              {criteria.map(([label, value]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:justify-between gap-1 border-b border-slate-800 pb-2">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white sm:text-right break-words sm:max-w-[75%]">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-amber-400 mb-3">Required documents</h3>
            {scheme.requiredDocuments.length > 0 ? (
              <ul className="list-disc list-inside text-slate-300 space-y-1">
                {scheme.requiredDocuments.map((document) => <li key={document}>{document}</li>)}
              </ul>
            ) : (
              <p className="text-slate-500">No documents specified.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    throw new Error(`API returned an empty response (HTTP ${response.status}).`);
  }

  try {
    const parsed: unknown = JSON.parse(responseText);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    throw new Error(`API returned a non-JSON response (HTTP ${response.status}).`);
  }
}

const ALLOWED_ADMIN_EMAILS = ['umarfarookm198@gmail.com', 'mohammedkaliff10@gmail.com'];

const PRESET_ACCOUNTS: Account[] = [
  { id: '1', name: 'Kaliff', email: 'mohammedkaliff10@gmail.com', role: 'Super Administrator', avatar: 'K' },
  { id: '2', name: 'Umar Farook', email: 'umarfarookm198@gmail.com', role: 'Administrator', avatar: 'U' },
  { id: '3', name: 'Unauthorized Student', email: 'student.test@gmail.com', role: 'Public Guest', avatar: 'S' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<Account>(PRESET_ACCOUNTS[2]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [customEmailInput, setCustomEmailInput] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [forceLogin, setForceLogin] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'landing' | 'calculator' | 'tracker' | 'admin'>('landing');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [selectedSchemeForApply, setSelectedSchemeForApply] = useState<Scheme | null>(null);
  const [selectedSchemeForDetail, setSelectedSchemeForDetail] = useState<Scheme | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<ApplicationRecord | null>(null);
  const [appStep, setAppStep] = useState<number>(1);
  const [appFormData, setAppFormData] = useState<AppFormData>({
    fullName: 'Kaliff',
    tribeName: 'Santhal',
    casteCertNo: 'ST-OD-2026-9901',
    instituteName: 'National Institute of Technology',
    courseName: 'B.Tech Computer Science',
    bankAccNo: '39482019284',
    ifscCode: 'SBIN0001234',
    declarationAccepted: false
  });
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, ApplicationDocument>>({});
  const [documentUploadError, setDocumentUploadError] = useState<string>('');

  const [calcData, setCalcData] = useState<CalcData>({
    income: '180000',
    state: 'Odisha',
    caste: 'ST',
    gender: 'Other',
    occupation: 'Student',
    age: '22',
    education: 'Undergraduate'
  });
  const [calcResult, setCalcResult] = useState<EligibilityResult[] | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>('RESTRICTED');
  const [accessSettingLoading, setAccessSettingLoading] = useState<boolean>(true);
  const [accessSettingSaving, setAccessSettingSaving] = useState<boolean>(false);
  const [accessSettingError, setAccessSettingError] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;

    const syncAccessMode = async () => {
      try {
        setAccessSettingLoading(true);
        setAccessSettingError('');

        const [accessResponse, sessionResponse] = await Promise.all([
          fetch('/api/access-setting'),
          fetch('/api/auth/me')
        ]);
        const data = await readJsonResponse(accessResponse);

        if (!accessResponse.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Unable to fetch access setting.');
        }

        if (isMounted) {
          setAccessMode((data.accessMode === 'PUBLIC' ? 'PUBLIC' : 'RESTRICTED'));

          if (sessionResponse.ok) {
            const sessionData = await readJsonResponse(sessionResponse);
            const sessionUser = sessionData.user as { email?: string; role?: string } | undefined;
            if (!sessionUser?.email || !sessionUser.role) {
              throw new Error('The authentication session response is invalid.');
            }
            const matched = PRESET_ACCOUNTS.find((account) => account.email === sessionUser.email);
            setCurrentUser(matched || {
              id: sessionUser.email,
              name: sessionUser.email.split('@')[0],
              email: sessionUser.email,
              role: sessionUser.role,
              avatar: sessionUser.email.charAt(0).toUpperCase()
            });
            setIsLoggedIn(true);
          }
        }
      } catch (error) {
        if (isMounted) {
          setAccessMode('RESTRICTED');
          setAccessSettingError(
            error instanceof Error ? error.message : 'Unable to load access setting.'
          );
        }
      } finally {
        if (isMounted) {
          setAccessSettingLoading(false);
        }
      }
    };

    syncAccessMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const [schemes] = useState<Scheme[]>([
    {
      id: 'SCH-001',
      title: 'National Overseas Scholarship for ST Students',
      ministry: 'Ministry of Tribal Affairs',
      amount: '₹20,00,000 / year',
      category: 'Higher Edu / Abroad',
      deadline: '2026-10-31',
      description: 'Financial assistance to meritorious ST students for pursuing Master degree, Ph.D. and Post-Doctoral research abroad.',
      requiredDocuments: ['Caste certificate', 'Admission offer letter', 'Income certificate', 'Academic transcripts'],
      eligibility: {
        eligibleStates: INDIAN_STATES,
        eligibleCaste: ['ST'],
        maxIncome: 600000,
        minAge: 21,
        maxAge: 35,
        eligibleGenders: GENDERS,
        eligibleOccupations: ['Student'],
        eligibleEducationLevels: ['Postgraduate', 'M.Phil', 'Ph.D.']
      }
    },
    {
      id: 'SCH-002',
      title: 'Top Class Education Scheme for ST Students',
      ministry: 'Ministry of Tribal Affairs',
      amount: 'Full Tuition Fee + ₹86,000 allowance',
      category: 'Undergraduate',
      deadline: '2026-11-15',
      description: 'Full financial support for ST students pursuing studies in notified premier institutes like IITs, NITs, IIMs, and AIIMS.',
      requiredDocuments: ['Caste certificate', 'Institute admission proof', 'Income certificate', 'Academic transcripts'],
      eligibility: {
        eligibleStates: INDIAN_STATES,
        eligibleCaste: ['ST'],
        maxIncome: 800000,
        minAge: 17,
        maxAge: 30,
        eligibleGenders: GENDERS,
        eligibleOccupations: ['Student'],
        eligibleEducationLevels: ['Undergraduate']
      }
    },
    {
      id: 'SCH-003',
      title: 'Pre-Matric Scholarship for ST Students (Class 9 & 10)',
      ministry: 'State & Central Joint Scheme',
      amount: '₹3,500 / year',
      category: 'Pre-Matric',
      deadline: '2026-09-30',
      description: 'Support to tribal parents for educating their children studying in classes IX and X to reduce dropout rates.',
      requiredDocuments: ['Caste certificate', 'School certificate', 'Income certificate', 'Bank details'],
      eligibility: {
        eligibleStates: ['Odisha', 'Jharkhand', 'Chhattisgarh'],
        eligibleCaste: ['ST'],
        maxIncome: 250000,
        minAge: 14,
        maxAge: 18,
        eligibleGenders: GENDERS,
        eligibleOccupations: ['Student'],
        eligibleEducationLevels: ['School']
      }
    },
    {
      id: 'SCH-004',
      title: 'Post-Matric Scholarship for ST Students (PMS-ST)',
      ministry: 'Ministry of Tribal Affairs',
      amount: 'Up to ₹13,500 / year + Hosteller Allowance',
      category: 'Post-Matric',
      deadline: '2026-12-15',
      description: 'Comprehensive financial support for post-matriculation or post-secondary courses in recognized institutions.',
      requiredDocuments: ['Caste certificate', 'Bonafide certificate', 'Income certificate', 'Previous marksheet'],
      eligibility: {
        eligibleStates: INDIAN_STATES,
        eligibleCaste: ['ST'],
        maxIncome: 250000,
        minAge: 16,
        maxAge: 35,
        eligibleGenders: GENDERS,
        eligibleOccupations: ['Student'],
        eligibleEducationLevels: ['Undergraduate', 'Postgraduate', 'M.Phil', 'Ph.D.']
      }
    },
    {
      id: 'SCH-005',
      title: 'National Fellowship & Scholarship for Higher Education',
      ministry: 'Ministry of Tribal Affairs',
      amount: '₹31,000 / month + Contingency',
      category: 'PhD / M.Phil',
      deadline: '2026-11-30',
      description: 'Fellowship assistance for ST students pursuing M.Phil and Ph.D. courses in Sciences, Humanities, and Social Sciences.',
      requiredDocuments: ['Caste certificate', 'Research admission proof', 'Income certificate', 'Research proposal'],
      eligibility: {
        eligibleStates: INDIAN_STATES,
        eligibleCaste: ['ST'],
        maxIncome: 600000,
        minAge: 21,
        maxAge: 45,
        eligibleGenders: GENDERS,
        eligibleOccupations: ['Student'],
        eligibleEducationLevels: ['Postgraduate', 'M.Phil', 'Ph.D.']
      }
    }
  ]);

  const [applications, setApplications] = useState<ApplicationRecord[]>([
    {
      id: 'APP-2026-9041',
      applicantName: 'Kaliff',
      applicantEmail: 'mohammedkaliff10@gmail.com',
      personalInfo: {
        fullName: 'Kaliff',
        tribeName: 'Santhal',
        casteCertNo: 'ST-OD-2026-9901',
        instituteName: 'National Institute of Technology',
        courseName: 'B.Tech Computer Science',
        bankAccNo: '39482019284',
        ifscCode: 'SBIN0001234'
      },
      eligibilityInputs: {
        income: '180000', state: 'Odisha', caste: 'ST', gender: 'Other',
        occupation: 'Student', age: '22', education: 'Undergraduate'
      },
      schemeId: 'SCH-002',
      schemeTitle: 'Top Class Education Scheme for ST Students',
      schemeDescription: 'Full financial support for ST students pursuing studies in notified premier institutes like IITs, NITs, IIMs, and AIIMS.',
      appliedDate: '2026-08-12',
      submittedAt: '2026-08-12T09:30:00.000Z',
      lastUpdated: '2026-08-14T11:15:00.000Z',
      amount: '₹2,50,000',
      status: 'Verified by Nodal Officer',
      stage: 3,
      documents: [
        { name: 'Caste certificate', url: '#', type: 'PDF' },
        { name: 'Admission letter', url: '#', type: 'PDF' }
      ]
    },
    {
      id: 'APP-2026-8812',
      applicantName: 'Umar Farook',
      applicantEmail: 'umarfarookm198@gmail.com',
      personalInfo: {
        fullName: 'Umar Farook',
        tribeName: 'Santhal',
        casteCertNo: 'ST-OD-2026-8802',
        instituteName: 'University of Oxford',
        courseName: 'M.Sc. Computer Science',
        bankAccNo: '39482019285',
        ifscCode: 'SBIN0001234'
      },
      eligibilityInputs: {
        income: '240000', state: 'Odisha', caste: 'ST', gender: 'Male',
        occupation: 'Student', age: '24', education: 'Postgraduate'
      },
      schemeId: 'SCH-001',
      schemeTitle: 'National Overseas Scholarship for ST Students',
      schemeDescription: 'Financial assistance to meritorious ST students for pursuing Master degree, Ph.D. and Post-Doctoral research abroad.',
      appliedDate: '2026-07-29',
      submittedAt: '2026-07-29T08:45:00.000Z',
      lastUpdated: '2026-08-02T15:20:00.000Z',
      amount: '₹20,00,000',
      status: 'Sanctioned & Disbursed',
      stage: 4,
      documents: []
    }
  ]);

  const isAuthorizedUser = useMemo<boolean>(() => {
    return isLoggedIn && currentUser.role.toLowerCase().includes('admin');
  }, [currentUser, isLoggedIn]);

  const handleCustomLogin = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanEmail = customEmailInput.toLowerCase().trim();
    if (!cleanEmail || !loginPassword) return;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password: loginPassword })
    })
      .then(async (response) => {
        const data = await readJsonResponse(response);
        if (!response.ok) {
          throw new Error(typeof data.message === 'string' ? data.message : 'Unable to sign in.');
        }

        const matched = PRESET_ACCOUNTS.find((account) => account.email === cleanEmail);
        const nameFromEmail = cleanEmail.split('@')[0];
        const nameFormatted = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
        setCurrentUser(matched || {
          id: Date.now().toString(),
          name: nameFormatted,
          email: cleanEmail,
          role: 'Administrator',
          avatar: nameFormatted.charAt(0)
        });
        setIsLoggedIn(true);
        setForceLogin(false);
        setLoginPassword('');
        setAuthError('');
        showToast(`Welcome back, ${nameFormatted}!`);
      })
      .catch((error: unknown) => {
        setIsLoggedIn(false);
        setAuthError(error instanceof Error ? error.message : 'Unable to sign in.');
      });
  };

  const filteredSchemes = useMemo<Scheme[]>(() => {
    return schemes.filter((scheme) => {
      const matchesSearch =
        scheme.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scheme.ministry.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = selectedCategory === 'All' || scheme.category === selectedCategory;
      return matchesSearch && matchesCat;
    });
  }, [schemes, searchQuery, selectedCategory]);

  const handleCalculateEligibility = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const results: EligibilityResult[] = schemes.map((scheme) => {
      const { isEligible, reasons } = checkSchemeEligibility(scheme, calcData);

      return {
        ...scheme,
        isEligible,
        reasons,
        matchPercentage: isEligible ? 98 : 45
      };
    });

    setCalcResult(results);
    showToast('Eligibility match evaluated successfully.');
  };

  const handleApplicationSubmit = () => {
    if (!selectedSchemeForApply) return;

    const missingDocuments = REQUIRED_UPLOADS.filter(({ key }) => !uploadedDocuments[key]);
    if (missingDocuments.length > 0) {
      setDocumentUploadError(`Please upload: ${missingDocuments.map(({ label }) => label).join(', ')}.`);
      return;
    }

    const newApp: ApplicationRecord = {
      id: `APP-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      applicantName: appFormData.fullName,
      applicantEmail: currentUser.email,
      personalInfo: {
        fullName: appFormData.fullName,
        tribeName: appFormData.tribeName,
        casteCertNo: appFormData.casteCertNo,
        instituteName: appFormData.instituteName,
        courseName: appFormData.courseName,
        bankAccNo: appFormData.bankAccNo,
        ifscCode: appFormData.ifscCode
      },
      eligibilityInputs: { ...calcData },
      schemeId: selectedSchemeForApply.id,
      schemeTitle: selectedSchemeForApply.title,
      schemeDescription: selectedSchemeForApply.description,
      appliedDate: new Date().toISOString().split('T')[0],
      submittedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      amount: selectedSchemeForApply.amount,
      status: 'Submitted & Pending Verification',
      stage: 1,
      documents: Object.values(uploadedDocuments)
    };

    setApplications((prev) => [newApp, ...prev]);
    setIsApplyModalOpen(false);
    setUploadedDocuments({});
    setDocumentUploadError('');
    setActiveTab('tracker');
    showToast('Scholarship application submitted successfully!');
  };

  const handleDocumentUpload = (documentKey: string, documentLabel: string, file: File | undefined) => {
    if (!file) return;

    if (!ACCEPTED_UPLOAD_TYPES.includes(file.type)) {
      setDocumentUploadError(`${documentLabel} must be a PDF, JPG, or PNG file.`);
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      setDocumentUploadError(`${documentLabel} must be 5MB or smaller.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setUploadedDocuments((previous) => ({
        ...previous,
        [documentKey]: {
          name: file.name,
          url: reader.result as string,
          type: file.type,
          documentType: documentLabel
        }
      }));
      setDocumentUploadError('');
    };
    reader.onerror = () => setDocumentUploadError(`Unable to read ${documentLabel}. Please try again.`);
    reader.readAsDataURL(file);
  };

  const removeDocument = (documentKey: string) => {
    setUploadedDocuments((previous) => {
      const next = { ...previous };
      delete next[documentKey];
      return next;
    });
    setDocumentUploadError('');
  };

  const handleApproveApplication = (appId: string) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return { ...app, status: 'Sanctioned & Disbursed (DBT)', stage: 4 };
        }
        return app;
      })
    );
    showToast(`Application ${appId} approved and DBT sanctioned.`);
  };

  const handleAccessModeToggle = async () => {
    if (!showAdminPortal) {
      return;
    }

    const nextMode: AccessMode = accessMode === 'PUBLIC' ? 'RESTRICTED' : 'PUBLIC';

    setAccessSettingSaving(true);
    setAccessSettingError('');

    try {
      const response = await fetch('/api/access-setting', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': currentUser.email,
          'x-admin-role': currentUser.role || 'Administrator'
        },
        body: JSON.stringify({ accessMode: nextMode })
      });

      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(typeof data.message === 'string' ? data.message : 'Unable to update access setting.');
      }

      setAccessMode(nextMode);
      showToast(`Access updated to ${nextMode === 'PUBLIC' ? 'Public' : 'Restricted'} mode.`);
    } catch (error) {
      setAccessSettingError(
        error instanceof Error ? error.message : 'Unable to update access setting.'
      );
      setAccessMode(accessMode);
    } finally {
      setAccessSettingSaving(false);
    }
  };

  const handleBackToSchemes = () => {
    setIsApplyModalOpen(false);
    setSelectedSchemeForApply(null);
    setActiveTab('landing');
  };

  const showAdminPortal = isLoggedIn && isAuthorizedUser;
  const isAccessAllowed = accessMode === 'PUBLIC' || showAdminPortal;

  if ((accessMode === 'RESTRICTED' && !showAdminPortal) || forceLogin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center p-3 text-amber-400">
              <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          </div>

          <div className="text-center mb-6">
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold rounded-full uppercase tracking-wider">
              Published Secure Portal
            </span>
            <h1 className="text-2xl font-bold mt-3 text-slate-100">tribalscholarship.application.com</h1>
            <p className="text-sm text-slate-400 mt-1">
              Access Restricted. Server-authenticated administrator access is required.
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium">
              {authError}
            </div>
          )}

          <div className="space-y-3 mb-6">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Authorized Identity:
            </label>
            {PRESET_ACCOUNTS.map((account) => {
              const isAllowed = ALLOWED_ADMIN_EMAILS.includes(account.email);
              return (
                <button
                  key={account.id}
                  onClick={() => {
                    setCurrentUser(account);
                    setCustomEmailInput(account.email);
                    setAuthError(isAllowed ? '' : `Access Denied: ${account.email} is not an administrator.`);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left ${
                    currentUser.email === account.email
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-400/40 font-bold text-amber-400 flex items-center justify-center text-sm">
                      {account.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center space-x-2">
                        <span>{account.name}</span>
                        {isAllowed && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            Authorized
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{account.email}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCustomLogin} className="space-y-3 pt-4 border-t border-slate-800">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Verify Custom Email:
            </label>
            <div className="flex space-x-2">
              <input
                type="email"
                placeholder="Enter email..."
                value={customEmailInput}
                onChange={(event) => setCustomEmailInput(event.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="password"
                placeholder="Password..."
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                required
              />
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm"
              >
                Access
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-slate-950 px-4 py-3 rounded-xl font-bold shadow-2xl text-xs animate-bounce">
          {toastMessage}
        </div>
      )}

      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 text-xs flex justify-between items-center text-slate-400">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Published Domain: <strong className="text-amber-400">tribalscholarship.application.com</strong></span>
        </div>
        <button
          onClick={async () => {
            try {
              const response = await fetch('/api/auth/logout', { method: 'POST' });
              const data = await readJsonResponse(response);
              if (!response.ok) {
                throw new Error(typeof data.message === 'string' ? data.message : 'Unable to sign out.');
              }
              setAuthError('');
            } catch (error) {
              setAuthError(error instanceof Error ? error.message : 'Unable to sign out.');
            } finally {
              setIsLoggedIn(false);
              setForceLogin(true);
            }
          }}
          className="text-slate-400 hover:text-amber-400 transition-colors underline"
        >
          {isLoggedIn ? 'Lock / Switch Account' : 'Admin Sign In'}
        </button>
      </div>

      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('landing')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 p-0.5 shadow-md">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-400 fill-current" viewBox="0 0 24 24">
                  <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.5 12.4 12 8.3l7.5 4.1L12 16.5zM12 19c-3.31 0-6 1.34-6 3h12c0-1.66-2.69-3-6-3z" />
                </svg>
              </div>
            </div>
            <div>
              <div className="font-extrabold text-lg text-white">Tribal Scholarship Hub</div>
              <div className="text-xs font-mono font-bold text-amber-400">tribalscholarship.application.com</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('landing')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'landing' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-300 hover:text-white'
              }`}
            >
              Schemes Directory
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'calculator' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-300 hover:text-white'
              }`}
            >
              Eligibility Calculator
            </button>
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'tracker' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-300 hover:text-white'
              }`}
            >
              Application Tracker
            </button>
            {showAdminPortal && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1.5 ${
                  activeTab === 'admin' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50' : 'text-amber-400'
                }`}
              >
                <span>Admin Portal</span>
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'landing' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search scholarship schemes..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredSchemes.map((scheme) => (
                <div key={scheme.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
                  <div className="space-y-3">
                    <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg">
                      {scheme.id}
                    </span>
                    <h3 className="text-lg font-bold text-white">{scheme.title}</h3>
                    <p className="text-xs text-slate-400">{scheme.description}</p>
                    <div className="text-xs text-emerald-400 font-bold">Grant: {scheme.amount}</div>
                  </div>
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSchemeForDetail(scheme)}
                      className="flex-1 border border-slate-700 hover:border-amber-400 text-slate-200 hover:text-amber-400 font-bold py-2.5 rounded-xl text-xs"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => {
                        setSelectedSchemeForApply(scheme);
                        setUploadedDocuments({});
                        setDocumentUploadError('');
                        setIsApplyModalOpen(true);
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs"
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'admin' && showAdminPortal && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h2 className="text-xl font-extrabold text-white">Admin Approval Desk ({currentUser.name})</h2>
                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">Current State</span>
                  <span className={`text-sm font-bold ${accessMode === 'PUBLIC' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {accessMode === 'PUBLIC' ? 'Public' : 'Restricted'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Public / Restricted</div>
                  <div className="text-sm text-white mt-1">{accessMode === 'PUBLIC' ? 'Public access is enabled.' : 'Restricted access is enabled.'}</div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${accessMode === 'PUBLIC' ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {accessMode === 'PUBLIC' ? 'Public' : 'Restricted'}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={accessMode === 'RESTRICTED'}
                      onChange={handleAccessModeToggle}
                      disabled={accessSettingSaving || accessSettingLoading}
                      className="sr-only peer"
                    />
                    <span className="w-12 h-6 bg-slate-800 rounded-full peer-checked:bg-emerald-500 transition-colors duration-200 relative">
                      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-6" />
                    </span>
                  </label>
                </div>
              </div>

              {accessSettingSaving && (
                <div className="text-xs text-amber-300">Saving access settings...</div>
              )}

              {accessSettingError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {accessSettingError}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
                    <tr>
                      <th className="p-3">App ID</th>
                      <th className="p-3">Applicant</th>
                      <th className="p-3">Scheme</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {applications.map((app) => (
                      <tr
                        key={app.id}
                        onClick={() => setSelectedApplication(app)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setSelectedApplication(app);
                        }}
                        tabIndex={0}
                        className="cursor-pointer hover:bg-slate-800/60 focus:outline-none focus:bg-slate-800/60"
                      >
                        <td className="p-3 font-mono font-bold text-amber-400">{app.id}</td>
                        <td className="p-3">{app.applicantName}</td>
                        <td className="p-3">{app.schemeTitle}</td>
                        <td className="p-3">{app.status}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedApplication(app);
                            }}
                            className="text-sky-400 hover:text-sky-300 font-bold px-3 py-1 rounded text-xs mr-2"
                          >
                            View
                          </button>
                          {app.stage < 4 && (
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleApproveApplication(app.id);
                              }}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded text-xs"
                            >
                              Approve & Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tracker' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-4">Application Tracker</h2>
              {applications.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => setSelectedApplication(app)}
                  className="block w-full text-left bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 hover:border-amber-400/50 focus:outline-none focus:border-amber-400"
                >
                  <div className="font-bold text-amber-400">{app.id} - {app.schemeTitle}</div>
                  <div className="text-xs text-slate-400 mt-1">Status: {app.status}</div>
                  <div className="text-xs text-sky-400 mt-2">View application details</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calculator' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-white mb-4">Eligibility Calculator</h2>
            <form onSubmit={handleCalculateEligibility} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Annual Income</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={calcData.income}
                  onChange={(event) => setCalcData({ ...calcData, income: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">State</label>
                <select required value={calcData.state} onChange={(event) => setCalcData({ ...calcData, state: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Caste / Category</label>
                <select required value={calcData.caste} onChange={(event) => setCalcData({ ...calcData, caste: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                  <option value="">Select category</option>
                  {CASTES.map((caste) => <option key={caste} value={caste}>{caste}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Gender</label>
                <select required value={calcData.gender} onChange={(event) => setCalcData({ ...calcData, gender: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                  <option value="">Select gender</option>
                  {GENDERS.map((gender) => <option key={gender} value={gender}>{gender}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Occupation type</label>
                <select required value={calcData.occupation} onChange={(event) => setCalcData({ ...calcData, occupation: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                  <option value="">Select occupation</option>
                  {OCCUPATIONS.map((occupation) => <option key={occupation} value={occupation}>{occupation}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Age</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  required
                  value={calcData.age}
                  onChange={(event) => setCalcData({ ...calcData, age: event.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Education level</label>
                <select required value={calcData.education} onChange={(event) => setCalcData({ ...calcData, education: event.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white">
                  <option value="">Select education level</option>
                  {EDUCATION_LEVELS.map((education) => <option key={education} value={education}>{education}</option>)}
                </select>
              </div>
              <button type="submit" className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl">Calculate</button>
            </form>
            {calcResult && (
              <div className="mt-6 space-y-3">
                {calcResult.map((res) => (
                  <div key={res.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <div className="font-bold text-white">{res.title}</div>
                    <div className={`text-xs ${res.isEligible ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {res.isEligible ? 'Eligible' : 'Not Eligible'}
                    </div>
                    {!res.isEligible && <div className="text-xs text-slate-400 mt-1">{res.reasons.join(' • ')}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {selectedSchemeForDetail && (
        <SchemeDetailModal
          scheme={selectedSchemeForDetail}
          onClose={() => setSelectedSchemeForDetail(null)}
        />
      )}

      {selectedApplication && (
        <ApplicationDetailModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}

      {isApplyModalOpen && selectedSchemeForApply && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBackToSchemes}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs font-bold text-slate-200 transition-all hover:bg-slate-800 hover:text-amber-400 w-full sm:w-auto"
              >
                <span aria-hidden="true">←</span>
                <span>Back to Scholarships</span>
              </button>
            </div>
            <h3 className="text-lg font-bold text-white">Apply for {selectedSchemeForApply.title}</h3>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                value={appFormData.fullName}
                onChange={(event) => setAppFormData({ ...appFormData, fullName: event.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                placeholder="Full Name"
              />
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <div>
                  <h4 className="font-bold text-white">Upload Documents</h4>
                  <p className="text-slate-400 mt-1">PDF, JPG, or PNG only. Maximum 5MB per file.</p>
                </div>
                {REQUIRED_UPLOADS.map(({ key, label }) => {
                  const uploadedDocument = uploadedDocuments[key];
                  return (
                    <div key={key} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                      <label className="block text-slate-300 font-bold mb-2">{label} <span className="text-rose-400">*</span></label>
                      <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={(event) => handleDocumentUpload(key, label, event.target.files?.[0])}
                        className="w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-2 file:font-bold file:text-slate-950"
                      />
                      {uploadedDocument && (
                        <div className="mt-2 flex items-center justify-between gap-2 text-emerald-400">
                          <span className="truncate">Uploaded: {uploadedDocument.name}</span>
                          <button type="button" onClick={() => removeDocument(key)} className="shrink-0 text-rose-400 hover:text-rose-300 underline">
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {documentUploadError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300" role="alert">
                    {documentUploadError}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleApplicationSubmit}
                className="w-full bg-emerald-500 text-slate-950 font-bold py-2.5 rounded-xl"
              >
                Submit Application
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-slate-950 border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        tribalscholarship.application.com &bull; Ministry of Tribal Affairs
      </footer>
    </div>
  );
}
