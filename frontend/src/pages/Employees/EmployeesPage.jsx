import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Plus, Search, FileSpreadsheet, FileText, Upload, Pencil, Trash2 } from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { Modal, Badge } from '@/components/ui/Modal';
import { employeeApi, departmentApi } from '@/services';
import { formatMoney } from '@/utils/helpers';

const EMPTY_EMPLOYEES = [];

const schema = z.object({
  employeeId: z.string().optional(),
  fullName: z.string().min(2, 'Required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  dob: z.string().optional(),
  village: z.string().optional(),
  address: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hourlyRate: z.coerce.number().min(0),
  hireDate: z.string().optional(),
  bank: z.string().optional(),
  accountNumber: z.string().optional(),
  npfNumber: z.string().optional(),
  status: z.enum(['active', 'inactive', 'terminated']),
  notes: z.string().optional(),
});

function downloadBlob(response, filename) {
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [sort, setSort] = useState('fullName');
  const [order, setOrder] = useState('asc');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.list,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['employees', debouncedSearch, status, department, sort, order],
    queryFn: () =>
      employeeApi.list({
        search: debouncedSearch,
        status,
        department,
        sort,
        order,
        limit: 100,
      }),
    placeholderData: keepPreviousData,
  });

  // Stable empty array — prevents TanStack Table infinite re-render hang
  const employees = data?.items ?? EMPTY_EMPLOYEES;

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { status: 'active', hourlyRate: 0 },
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);
      if (editing) return employeeApi.update(editing._id, fd);
      return employeeApi.create(fd);
    },
    onSuccess: () => {
      toast.success(editing ? 'Employee updated' : 'Employee created');
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setOpen(false);
      setEditing(null);
      setPhoto(null);
      form.reset({ status: 'active', hourlyRate: 0 });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: employeeApi.remove,
    onSuccess: () => {
      toast.success('Employee deleted');
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ status: 'active', hourlyRate: 0 });
    setPhoto(null);
    setOpen(true);
  };

  const openEdit = useCallback((row) => {
    setEditing(row);
    form.reset({
      employeeId: row.employeeId || '',
      fullName: row.fullName || '',
      email: row.email || '',
      phone: row.phone || '',
      dob: row.dob ? String(row.dob).slice(0, 10) : '',
      village: row.village || '',
      address: row.address || '',
      department: row.department?._id || row.department || '',
      position: row.position || '',
      hourlyRate: row.hourlyRate || 0,
      hireDate: row.hireDate ? String(row.hireDate).slice(0, 10) : '',
      bank: row.bank || '',
      accountNumber: row.accountNumber || '',
      npfNumber: row.npfNumber || '',
      status: row.status || 'active',
      notes: row.notes || '',
    });
    setPhoto(null);
    setOpen(true);
  }, [form]);

  const handleDelete = useCallback((id) => {
    if (confirm('Delete employee?')) deleteMutation.mutate(id);
  }, [deleteMutation]);

  const columns = useMemo(
    () => [
      { accessorKey: 'employeeId', header: 'ID' },
      {
        accessorKey: 'fullName',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {row.original.photo ? (
              <img src={row.original.photo} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-blue-100 text-primary flex items-center justify-center text-xs font-bold">
                {row.original.fullName?.[0]}
              </div>
            )}
            <span className="font-medium">{row.original.fullName}</span>
          </div>
        ),
      },
      {
        id: 'department',
        header: 'Department',
        cell: ({ row }) => row.original.department?.name || '—',
      },
      { accessorKey: 'position', header: 'Position' },
      {
        accessorKey: 'hourlyRate',
        header: 'Rate',
        cell: ({ getValue }) => formatMoney(getValue()),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const v = getValue();
          return (
            <Badge tone={v === 'active' ? 'success' : v === 'inactive' ? 'warning' : 'danger'}>
              {v}
            </Badge>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="p-2 rounded-full hover:bg-slate-100 cursor-pointer"
              onClick={() => openEdit(row.original)}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              className="p-2 rounded-full hover:bg-red-50 text-danger cursor-pointer"
              onClick={() => handleDelete(row.original._id)}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ),
      },
    ],
    [openEdit, handleDelete]
  );

  const table = useReactTable({
    data: employees,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const onExportExcel = async () => {
    setExporting(true);
    try {
      downloadBlob(await employeeApi.exportExcel(), 'employees.xlsx');
      toast.success('Excel downloaded');
    } catch {
      toast.error('Excel export failed');
    } finally {
      setExporting(false);
    }
  };

  const onExportPdf = async () => {
    setExporting(true);
    try {
      downloadBlob(await employeeApi.exportPdf(), 'employees.pdf');
      toast.success('PDF downloaded');
    } catch {
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await employeeApi.importExcel(file);
      toast.success(`Imported ${res.imported}`);
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    }
  };

  return (
    <AppLayout title="Employees">
      <div className="space-y-4">
        <Card className="flex flex-col xl:flex-row xl:items-end gap-3 justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">Search</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  className="w-full rounded-[18px] border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </Select>
            <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </Select>
            <Select
              label="Sort"
              value={`${sort}:${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split(':');
                setSort(s);
                setOrder(o);
              }}
            >
              <option value="fullName:asc">Name A–Z</option>
              <option value="fullName:desc">Name Z–A</option>
              <option value="hourlyRate:desc">Rate high</option>
              <option value="hourlyRate:asc">Rate low</option>
              <option value="employeeId:asc">ID</option>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={exporting} onClick={onExportExcel}>
              <FileSpreadsheet size={16} /> Excel
            </Button>
            <Button type="button" variant="outline" disabled={exporting} onClick={onExportPdf}>
              <FileText size={16} /> PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload size={16} /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={onImport}
            />
            <Button type="button" onClick={openCreate}>
              <Plus size={16} /> Add Employee
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {(isLoading || isFetching) && (
            <div className="px-4 py-2 text-xs text-muted border-b border-border bg-slate-50">
              Updating list…
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-border">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="text-left px-4 py-3 font-medium text-muted whitespace-nowrap">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {!isLoading && employees.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={columns.length}>
                      No employees found
                    </td>
                  </tr>
                )}
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 hover:bg-slate-50/80">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        className="max-w-3xl"
      >
        <form
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
        >
          <Input label="Employee ID" {...form.register('employeeId')} placeholder="Auto if empty" />
          <Input label="Full Name" {...form.register('fullName')} error={form.formState.errors.fullName?.message} />
          <Input label="Email" type="email" {...form.register('email')} />
          <Input label="Phone" {...form.register('phone')} />
          <Input label="Date of Birth" type="date" {...form.register('dob')} />
          <Input label="Hire Date" type="date" {...form.register('hireDate')} />
          <Input label="Village" {...form.register('village')} />
          <Input label="Address" {...form.register('address')} />
          <Select label="Department" {...form.register('department')}>
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </Select>
          <Input label="Position" {...form.register('position')} />
          <Input label="Hourly Rate" type="number" step="0.01" {...form.register('hourlyRate')} />
          <Input label="Bank" {...form.register('bank')} />
          <Input label="Account Number" {...form.register('accountNumber')} />
          <Input label="NPF Number" {...form.register('npfNumber')} />
          <Select label="Status" {...form.register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </Select>
          <FileUpload
            className="sm:col-span-2"
            label="Photo"
            accept="image/*"
            value={photo}
            previewUrl={!photo && editing?.photo ? editing.photo : undefined}
            onChange={setPhoto}
            hint="Employee photo — PNG or JPG"
          />
          <div className="sm:col-span-2">
            <Textarea label="Notes" {...form.register('notes')} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
