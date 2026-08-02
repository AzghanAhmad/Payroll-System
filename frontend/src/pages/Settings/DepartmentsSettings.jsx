import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { departmentApi } from '@/services';

export default function DepartmentsSettings() {
  const qc = useQueryClient();
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.list,
  });
  const [deptName, setDeptName] = useState('');
  const [adding, setAdding] = useState(false);

  const addDept = async () => {
    if (!deptName.trim()) return;
    setAdding(true);
    try {
      await departmentApi.create({ name: deptName.trim() });
      toast.success('Department added');
      setDeptName('');
      qc.invalidateQueries({ queryKey: ['departments'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg">Departments</h2>
        <p className="text-sm text-muted">Used for staff assignment and ACC department splits.</p>
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              label="New department"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addDept();
              }}
            />
          </div>
          <Button type="button" onClick={addDept} disabled={adding || !deptName.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <ul className="text-sm space-y-1">
            {departments.map((d) => (
              <li key={d._id} className="flex justify-between border-b border-border/50 py-2.5">
                <span className="font-medium">{d.name}</span>
                {d.code ? <span className="text-muted text-xs">{d.code}</span> : null}
              </li>
            ))}
            {!departments.length && (
              <li className="text-muted py-4">No departments yet. Add Café, Chemist, etc.</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
