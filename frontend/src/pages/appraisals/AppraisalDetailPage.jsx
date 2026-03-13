import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import PageWrapper from '../../components/layout/PageWrapper';
import Button from '../../components/ui/Button';

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  unit_reviewed: 'Unit Reviewed',
  admin_reviewed: 'Admin Reviewed',
  completed: 'Completed',
};

const STATUS_COLORS = {
  draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  submitted: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  unit_reviewed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  admin_reviewed: 'bg-accent-500/10 text-accent-400 border-accent-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const ROLE_LABELS = {
  admin: 'HR / Admin',
  lead: 'Unit Head',
  member: 'Employee',
};

export default function AppraisalDetailPage() {
  const { id } = useParams();
  const { user, orgRole } = useAuth();
  const navigate = useNavigate();
  const [appraisal, setAppraisal] = useState(null);
  const [formStructure, setFormStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState(null); // set after load based on role

  // Local form state
  const [selfAssessment, setSelfAssessment] = useState({});
  const [selfRatings, setSelfRatings] = useState({});
  const [technicalAnswers, setTechnicalAnswers] = useState({});
  const [unitHeadScores, setUnitHeadScores] = useState({});
  const [unitHeadComment, setUnitHeadComment] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [mdComment, setMdComment] = useState('');
  const [mdScore, setMdScore] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const appraisalRes = await api.get(`/appraisals/${id}`);
        const a = appraisalRes.data;
        setAppraisal(a);

        // Fetch form structure for this appraisal's department
        const structureRes = await api.get(`/appraisals/form-structure?department=${a.department || 'tech'}`);
        setFormStructure(structureRes.data);

        // Load existing data into form state
        setSelfAssessment(a.selfAssessment || {});
        setSelfRatings(a.selfRatings || {});
        setTechnicalAnswers(a.technicalAnswers || {});
        setUnitHeadScores(a.unitHeadScores || {});
        setUnitHeadComment(a.unitHeadComment || '');
        setAdminComment(a.adminComment || '');
        setMdComment(a.mdComment || '');
        setMdScore(a.mdScore || 0);
      } catch (err) {
        console.error('Failed to load appraisal:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Role-based access logic ──
  const isEmployee = appraisal?.employeeId === user?.id;
  const role = orgRole || 'member';
  const isUnitHead = role === 'lead';
  const isAdmin = role === 'admin';
  const status = appraisal?.status;

  // What can each role SEE?
  const canSeeSection1 = true; // Everyone can see Section 1 (employee self-assessment)
  const canSeeDeptQuestions = true; // Everyone can see department questions
  const canSeeSection2 = isUnitHead || isAdmin; // Only unit head & admin can see Section 2
  const canSeeSection3 = isAdmin; // Only admin can see Section 3

  // What can each role EDIT?
  const canEditEmployee = isEmployee && status === 'draft';
  const canEditUnitHead = isUnitHead && status === 'submitted';
  const canEditAdmin = isAdmin && (status === 'unit_reviewed' || status === 'admin_reviewed');
  const canEditMd = isAdmin && status === 'admin_reviewed';

  // Set default active section based on role
  useEffect(() => {
    if (!appraisal || activeSection) return;
    if (isAdmin) {
      // Admin defaults to the section they need to act on
      if (status === 'unit_reviewed') setActiveSection('section2');
      else if (status === 'admin_reviewed') setActiveSection('section3');
      else setActiveSection('section1');
    } else if (isUnitHead) {
      setActiveSection(status === 'submitted' ? 'section2' : 'section1');
    } else {
      setActiveSection('section1');
    }
  }, [appraisal, isAdmin, isUnitHead, status, activeSection]);

  const selfRatingTotal = Object.values(selfRatings).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const unitHeadTotal = Object.values(unitHeadScores).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const deptLabel = formStructure?.departmentLabel || 'Department';
  const hasDeptQuestions = formStructure?.departmentQuestions?.length > 0;

  // Build visible tabs based on role
  const SECTIONS = [
    ...(canSeeSection1 ? [{ key: 'section1', label: 'Self Assessment', icon: '📝' }] : []),
    ...(canSeeDeptQuestions && hasDeptQuestions ? [{ key: 'department', label: deptLabel, icon: appraisal?.department === 'sales' ? '💰' : '💻' }] : []),
    ...(canSeeSection2 ? [{ key: 'section2', label: 'Unit Head Review', icon: '👔' }] : []),
    ...(canSeeSection3 ? [{ key: 'section3', label: 'Management', icon: '🏢' }] : []),
  ];

  async function handleSaveDraft() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/appraisals/${id}/employee`, {
        selfAssessment,
        selfRatings,
        technicalAnswers,
      });
      setAppraisal(data);
      showSuccess('Draft saved!');
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      await api.patch(`/appraisals/${id}/employee`, {
        selfAssessment,
        selfRatings,
        technicalAnswers,
      });
      const { data } = await api.post(`/appraisals/${id}/submit`);
      setAppraisal(data);
      showSuccess('Appraisal submitted for review!');
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnitHeadSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/appraisals/${id}/unit-head`, {
        unitHeadScores,
        unitHeadComment,
      });
      setAppraisal(data);
      showSuccess('Unit Head review saved!');
    } catch (err) {
      console.error('Unit head save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleAdminSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/appraisals/${id}/admin`, { adminComment });
      setAppraisal(data);
      showSuccess('Admin comment saved!');
    } catch (err) {
      console.error('Admin save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleMdSave() {
    setSaving(true);
    try {
      const { data } = await api.patch(`/appraisals/${id}/md`, { mdComment, mdScore: Number(mdScore) });
      setAppraisal(data);
      showSuccess('MD comment saved. Appraisal completed!');
    } catch (err) {
      console.error('MD save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  function showSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  if (!appraisal || !formStructure) {
    return (
      <PageWrapper>
        <div className="text-center py-20 text-slate-400">Appraisal not found.</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate('/appraisals')} className="text-xs text-accent-400 hover:text-accent-300 mb-2 flex items-center gap-1 cursor-pointer">
              &larr; Back to Appraisals
            </button>
            <h2 className="text-2xl font-bold text-white">
              Performance Appraisal
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-slate-400">{appraisal.employee?.name}</span>
              <span className="text-slate-600">&middot;</span>
              <span className="text-xs text-slate-500">
                {new Date(appraisal.reviewPeriodFrom).toLocaleDateString()} &mdash; {new Date(appraisal.reviewPeriodTo).toLocaleDateString()}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[appraisal.status]}`}>
                {STATUS_LABELS[appraisal.status]}
              </span>
              <span className="text-[10px] font-medium text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
                Viewing as: {ROLE_LABELS[role] || role}
              </span>
            </div>
          </div>
          {canEditEmployee && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
                {saving ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>Submit</Button>
            </div>
          )}
        </div>

        {/* Success message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-sm text-emerald-400"
          >
            {success}
          </motion.div>
        )}

        {/* Role info banner for staff */}
        {role === 'member' && !isEmployee && (
          <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-400">
            You can only view appraisals assigned to you.
          </div>
        )}

        {/* Section tabs */}
        <div className="flex gap-1 p-1 bg-slate-900/60 border border-white/[0.06] rounded-xl mb-6 overflow-x-auto">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer
                ${activeSection === s.key
                  ? 'bg-accent-500/15 text-accent-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}`}
            >
              <span>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* ── SECTION 1: Self Assessment ── */}
        {activeSection === 'section1' && canSeeSection1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Read-only banner for non-employees */}
            {!isEmployee && (
              <div className="px-4 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-xs text-slate-500 flex items-center gap-2">
                <span>👁</span> You are viewing the employee&apos;s self-assessment (read-only)
              </div>
            )}

            {/* A1 Self-assessment questions */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                <span className="text-accent-400">A1</span> Discussion Points
              </h3>
              <p className="text-xs text-slate-500 mb-4">Answer these questions about your role and performance</p>

              <div className="space-y-4">
                {formStructure.selfAssessmentQuestions.map((q) => (
                  <div key={q.key}>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">{q.label}</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                      value={selfAssessment[q.key] || ''}
                      onChange={(e) => setSelfAssessment({ ...selfAssessment, [q.key]: e.target.value })}
                      disabled={!canEditEmployee}
                      placeholder={canEditEmployee ? 'Your answer...' : ''}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Self-rating attributes */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="text-accent-400">A2</span> Self-Rating
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Rate yourself on the following attributes (max 10 each)</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white tabular-nums">{selfRatingTotal}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">/ {formStructure.selfRatingAttributes.length * 10}</div>
                </div>
              </div>

              <div className="space-y-2">
                {formStructure.selfRatingAttributes.map((attr) => (
                  <div key={attr.key} className="flex items-center justify-between p-3 bg-slate-800/30 border border-white/[0.04] rounded-lg">
                    <span className="text-xs text-slate-300 flex-1 pr-4">{attr.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={attr.maxScore}
                        className="w-16 px-2 py-1 bg-slate-800/80 border border-white/[0.08] rounded-lg text-sm text-center text-white outline-none focus:border-accent-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        value={selfRatings[attr.key] ?? ''}
                        onChange={(e) => {
                          const val = Math.min(Number(e.target.value), attr.maxScore);
                          setSelfRatings({ ...selfRatings, [attr.key]: val });
                        }}
                        disabled={!canEditEmployee}
                      />
                      <span className="text-[10px] text-slate-600 w-6">/{attr.maxScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── DEPARTMENT-SPECIFIC SECTION ── */}
        {activeSection === 'department' && canSeeDeptQuestions && hasDeptQuestions && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Read-only banner for non-employees */}
            {!isEmployee && (
              <div className="mb-4 px-4 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-xs text-slate-500 flex items-center gap-2">
                <span>👁</span> You are viewing the employee&apos;s department responses (read-only)
              </div>
            )}

            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                {appraisal?.department === 'sales' ? '💰' : '💻'} {deptLabel}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {appraisal?.department === 'sales'
                  ? 'Answer questions about your sales performance, marketing, and client engagement'
                  : 'Answer questions about your technical work and contributions'}
              </p>

              <div className="space-y-4">
                {formStructure.departmentQuestions.map((q) => (
                  <div key={q.key}>
                    <label className="text-xs font-medium text-slate-300 block mb-1.5">{q.label}</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                      value={technicalAnswers[q.key] || ''}
                      onChange={(e) => setTechnicalAnswers({ ...technicalAnswers, [q.key]: e.target.value })}
                      disabled={!canEditEmployee}
                      placeholder={canEditEmployee ? 'Your answer...' : ''}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SECTION 2: Unit Head Review ── */}
        {activeSection === 'section2' && canSeeSection2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Status banner */}
            {isUnitHead && status !== 'submitted' && (
              <div className="px-4 py-2 bg-slate-800/50 border border-white/[0.06] rounded-lg text-xs text-slate-500 flex items-center gap-2">
                <span>ℹ️</span>
                {status === 'draft' ? 'Waiting for employee to submit their self-assessment' : 'Review has already been submitted'}
              </div>
            )}

            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    👔 Unit Head Scoring
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Score: 8=Excellent, 6=Good, 4=Improve, 2=Poor</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-white tabular-nums">{unitHeadTotal}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">/ {formStructure.unitHeadAttributes.length * 8}</div>
                </div>
              </div>

              {/* Score legend */}
              <div className="flex gap-3 mb-4 flex-wrap">
                {[{ s: 8, l: 'Excellent' }, { s: 6, l: 'Good' }, { s: 4, l: 'Improve' }, { s: 2, l: 'Poor' }].map((item) => (
                  <span key={item.s} className="text-[10px] text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
                    {item.s} = {item.l}
                  </span>
                ))}
              </div>

              <div className="space-y-2">
                {formStructure.unitHeadAttributes.map((attr, i) => (
                  <div key={attr.key} className="flex items-center justify-between p-3 bg-slate-800/30 border border-white/[0.04] rounded-lg">
                    <span className="text-xs text-slate-300 flex-1 pr-4">
                      <span className="text-slate-500 mr-2">{i + 1}.</span>
                      {attr.label}
                    </span>
                    <div className="flex gap-1">
                      {[8, 6, 4, 2].map((score) => (
                        <button
                          key={score}
                          onClick={() => canEditUnitHead && setUnitHeadScores({ ...unitHeadScores, [attr.key]: score })}
                          disabled={!canEditUnitHead}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all
                            ${canEditUnitHead ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}
                            ${unitHeadScores[attr.key] === score
                              ? score >= 6
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : score >= 4
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-white/[0.04] text-slate-500 border border-transparent hover:bg-white/[0.08]'}`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Unit Head Comment */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-3">Comment by Unit Head</h3>
              <textarea
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                value={unitHeadComment}
                onChange={(e) => setUnitHeadComment(e.target.value)}
                disabled={!canEditUnitHead}
                placeholder={canEditUnitHead ? 'Your comments on this employee\'s performance...' : ''}
              />
              {canEditUnitHead && (
                <div className="mt-3">
                  <Button onClick={handleUnitHeadSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Unit Head Review'}
                  </Button>
                </div>
              )}
            </div>

            {/* Admin Comment (visible to admin viewing section 2) */}
            {isAdmin && (
              <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
                <h3 className="text-sm font-bold text-white mb-3">Comment by Head, Administration</h3>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  disabled={!canEditAdmin}
                  placeholder={canEditAdmin ? 'Administration comments...' : ''}
                />
                {canEditAdmin && (
                  <div className="mt-3">
                    <Button onClick={handleAdminSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Admin Comment'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── SECTION 3: Management / MD Comments (Admin only) ── */}
        {activeSection === 'section3' && canSeeSection3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* MD Comment */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                🏢 Managing Director&apos;s Overall Comments
              </h3>
              <p className="text-xs text-slate-500 mb-4">Final review and comments from management</p>

              <textarea
                rows={5}
                className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.06] rounded-lg text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all resize-y disabled:opacity-60 disabled:cursor-not-allowed"
                value={mdComment}
                onChange={(e) => setMdComment(e.target.value)}
                disabled={!canEditMd}
                placeholder={canEditMd ? 'Managing Director\'s overall comments on this appraisal...' : ''}
              />
            </div>

            {/* MD Score */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                🎯 MD Performance Score
              </h3>
              <p className="text-xs text-slate-500 mb-4">Rate this employee&apos;s overall performance (0-100)</p>

              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-24 px-4 py-3 bg-slate-800/80 border border-white/[0.08] rounded-xl text-xl text-center font-bold text-white outline-none focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  value={mdScore}
                  onChange={(e) => setMdScore(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  disabled={!canEditMd}
                />
                <span className="text-sm text-slate-500">/ 100</span>

                {/* Score preview bar */}
                <div className="flex-1 h-3 bg-slate-800/50 rounded-full overflow-hidden border border-white/[0.04]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      mdScore >= 96 ? 'bg-emerald-500' :
                      mdScore >= 81 ? 'bg-blue-500' :
                      mdScore >= 65 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${mdScore}%` }}
                  />
                </div>
              </div>

              {canEditMd && (
                <div className="mt-4">
                  <Button onClick={handleMdSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save & Complete Appraisal'}
                  </Button>
                </div>
              )}
            </div>

            {/* Scoring breakdown & weights */}
            <div className="bg-slate-900/60 border border-white/[0.06] rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                📊 Score Breakdown & Weights
              </h3>
              <p className="text-xs text-slate-500 mb-4">Final score = Self Rating (30%) + Unit Head (50%) + MD Score (20%)</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-slate-800/30 rounded-xl border border-white/[0.04] text-center">
                  <div className="text-[10px] text-accent-400 uppercase tracking-wider font-bold mb-1">Self Rating (30%)</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{selfRatingTotal}</div>
                  <div className="text-[10px] text-slate-500">/ {formStructure.selfRatingAttributes.length * 10}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formStructure.scoring?.selfRatingMax > 0
                      ? `${((selfRatingTotal / formStructure.scoring.selfRatingMax) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="p-4 bg-slate-800/30 rounded-xl border border-white/[0.04] text-center">
                  <div className="text-[10px] text-emerald-400 uppercase tracking-wider font-bold mb-1">Unit Head (50%)</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{unitHeadTotal}</div>
                  <div className="text-[10px] text-slate-500">/ {formStructure.unitHeadAttributes.length * 8}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {formStructure.scoring?.unitHeadMax > 0
                      ? `${((unitHeadTotal / formStructure.scoring.unitHeadMax) * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="p-4 bg-slate-800/30 rounded-xl border border-white/[0.04] text-center">
                  <div className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">MD Score (20%)</div>
                  <div className="text-2xl font-bold text-white tabular-nums">{mdScore}</div>
                  <div className="text-[10px] text-slate-500">/ 100</div>
                  <div className="text-xs text-slate-400 mt-1">{mdScore}%</div>
                </div>
              </div>

              {/* Grade table */}
              <div className="space-y-1.5">
                {[
                  { grade: 'A', min: 96, max: 100, label: 'Outstanding Performance', color: 'emerald' },
                  { grade: 'B', min: 81, max: 95, label: 'Good Performance', color: 'blue' },
                  { grade: 'C', min: 65, max: 80, label: 'Satisfactory Performance', color: 'amber' },
                  { grade: 'D', min: 0, max: 64, label: 'Below Standard — Staff advised to resign', color: 'red' },
                ].map((g) => (
                  <div
                    key={g.grade}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all
                      ${appraisal.grade === g.grade
                        ? `bg-${g.color}-500/15 border-${g.color}-500/30`
                        : 'bg-slate-800/20 border-white/[0.04]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                        ${g.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
                          g.color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
                          g.color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'}`}>
                        {g.grade}
                      </span>
                      <div>
                        <span className="text-xs font-medium text-slate-300">{g.label}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{g.min}% — {g.max}%</span>
                      </div>
                    </div>
                    {appraisal.grade === g.grade && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-white/[0.1] px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Final result (only when completed) */}
            {appraisal.status === 'completed' && appraisal.finalScore > 0 && (
              <div className={`rounded-xl p-6 border-2 text-center
                ${appraisal.grade === 'A' ? 'bg-emerald-500/10 border-emerald-500/30' :
                  appraisal.grade === 'B' ? 'bg-blue-500/10 border-blue-500/30' :
                  appraisal.grade === 'C' ? 'bg-amber-500/10 border-amber-500/30' :
                  'bg-red-500/10 border-red-500/30'}`}
              >
                <div className="text-xs uppercase tracking-widest text-slate-400 mb-2">Final Appraisal Result</div>
                <div className="text-5xl font-black text-white tabular-nums mb-1">{appraisal.finalScore}%</div>
                <div className={`text-3xl font-black mb-2
                  ${appraisal.grade === 'A' ? 'text-emerald-400' :
                    appraisal.grade === 'B' ? 'text-blue-400' :
                    appraisal.grade === 'C' ? 'text-amber-400' : 'text-red-400'}`}>
                  Grade {appraisal.grade}
                </div>
                <div className="text-sm text-slate-400">
                  {appraisal.grade === 'A' ? 'Outstanding Performance' :
                   appraisal.grade === 'B' ? 'Good Performance' :
                   appraisal.grade === 'C' ? 'Satisfactory Performance' :
                   'Below Standard — Staff advised to resign'}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Bottom save bar for employee */}
        {canEditEmployee && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={handleSaveDraft} disabled={saving}>
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>Submit for Review</Button>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
