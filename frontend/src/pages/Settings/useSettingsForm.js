import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { settingsApi } from '@/services';

/** Shared settings form state + save for settings subpages */
export function useSettingsForm(pickFields) {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });
  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);

  useEffect(() => {
    if (settings) {
      const { _id, __v, createdAt, updatedAt, _applied, ...rest } = settings;
      setForm(rest);
    }
  }, [settings]);

  const set = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveMut = useMutation({
    mutationFn: async () => {
      const full = {
        companyName: form.companyName || '',
        companyAddress: form.companyAddress || '',
        companyPhone: form.companyPhone || '',
        companyEmail: form.companyEmail || '',
        currency: form.currency || 'USD',
        weekStart: form.weekStart || 'friday',
        normalHoursCap: Number(form.normalHoursCap) || 40,
        otMultiplier: Number(form.otMultiplier) || 1.5,
        doubleMultiplier: Number(form.doubleMultiplier) || 2,
        doubleTimeRule: form.doubleTimeRule || 'sunday',
        employerNpfRate: Number(form.employerNpfRate) || 0,
        employeeNpfRate: Number(form.employeeNpfRate) || 0,
        employerAccRate: Number(form.employerAccRate) || 0,
        employeeAccRate: Number(form.employeeAccRate) || 0,
        teaFundAmount: Number(form.teaFundAmount) || 0,
        leaveAnnual: Number(form.leaveAnnual) || 10,
        leaveSick: Number(form.leaveSick) || 10,
        leaveMaternity: Number(form.leaveMaternity) || 20,
        leavePaternity: Number(form.leavePaternity) || 3,
        leaveBereavement: Number(form.leaveBereavement) || 3,
        npfEmployerNumber: form.npfEmployerNumber || '',
        npfZone: form.npfZone || '',
        accEmpNumber1: form.accEmpNumber1 || '',
        accEmpNumber2: form.accEmpNumber2 || '',
        digitalSignature: form.digitalSignature || '',
      };
      if (form.taxBrackets) full.taxBrackets = form.taxBrackets;

      const payload = pickFields
        ? Object.fromEntries(pickFields.map((k) => [k, full[k]]))
        : full;

      if (logo && (!pickFields || pickFields.includes('logo') || pickFields.includes('companyName'))) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        });
        fd.append('logo', logo);
        return settingsApi.update(fd);
      }

      return settingsApi.update(payload);
    },
    onSuccess: (data) => {
      const applied = data?._applied;
      if (applied) {
        toast.success(
          `Settings saved — updated ${applied.timesheets || 0} timesheet(s), ${applied.payrollCount || 0} payroll(s), ${applied.payslipCount || 0} payslip(s)`
        );
      } else {
        toast.success('Settings saved');
      }
      setLogo(null);
      if (data?.currency) localStorage.setItem('currency', data.currency);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      qc.invalidateQueries({ queryKey: ['payslips'] });
      qc.invalidateQueries({ queryKey: ['leave-dashboard'] });
      qc.invalidateQueries({ queryKey: ['leave-staff-sheets'] });
      qc.invalidateQueries({ queryKey: ['statutory'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  return {
    form,
    set,
    logo,
    setLogo,
    isLoading,
    save: () => saveMut.mutate(),
    isSaving: saveMut.isPending,
  };
}
