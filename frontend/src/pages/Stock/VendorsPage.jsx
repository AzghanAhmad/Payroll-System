import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  Edit2,
  Trash2,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Search,
  X,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { vendorApi } from '@/services';
import toast from 'react-hot-toast';
import WhatsAppShareModal from '@/components/stock/WhatsAppShareModal';

export default function VendorsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTargetText, setWaTargetText] = useState('');
  const [waTargetVendor, setWaTargetVendor] = useState(null);

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vendors-list'],
    queryFn: () => vendorApi.list({}),
  });

  const vendors = data?.items || [];

  const createMutation = useMutation({
    mutationFn: vendorApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors-list'] });
      toast.success('Vendor added');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error adding vendor'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => vendorApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors-list'] });
      toast.success('Vendor updated');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating vendor'),
  });

  const deleteMutation = useMutation({
    mutationFn: vendorApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors-list'] });
      toast.success('Vendor removed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting vendor'),
  });

  const openModal = (v = null) => {
    if (v) {
      setEditingVendor(v);
      setForm({
        name: v.name || '',
        contactPerson: v.contactPerson || '',
        phone: v.phone || '',
        email: v.email || '',
        address: v.address || '',
        notes: v.notes || '',
      });
    } else {
      setEditingVendor(null);
      setForm({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingVendor(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Vendor name is required');

    if (editingVendor) {
      updateMutation.mutate({ id: editingVendor._id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleWhatsAppContact = (vendor) => {
    setWaTargetVendor(vendor);
    const msg = `Hello ${vendor.contactPerson || vendor.name},\n\nWe are contacting you from Alpha Group regarding an inventory purchase inquiry / stock supply.\n\nPlease share your current catalog and unit availability.\n\nThank you!`;
    setWaTargetText(msg);
    setWaModalOpen(true);
  };

  const filtered = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.contactPerson?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <StockLayout title="Vendors & Suppliers">
      {/* Header Bar */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Vendor Directory</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your suppliers, raw material partners, and dispatch purchase inquiries via WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
          </div>
          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vendor</span>
          </button>
        </div>
      </div>

      {/* Vendors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-400">Loading vendors...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400">No vendors found.</div>
        ) : (
          filtered.map((vendor) => (
            <div
              key={vendor._id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:border-sky-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Truck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base leading-tight">{vendor.name}</h3>
                      {vendor.contactPerson && (
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Attn: {vendor.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openModal(vendor)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete vendor "${vendor.name}"?`)) {
                          deleteMutation.mutate(vendor._id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-2 text-xs text-slate-600">
                  {vendor.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {vendor.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{vendor.address}</span>
                    </div>
                  )}
                  {vendor.notes && (
                    <p className="text-slate-500 bg-slate-50 p-2.5 rounded-xl mt-3 text-[11px] italic">
                      &quot;{vendor.notes}&quot;
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleWhatsAppContact(vendor)}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center justify-center gap-2 border border-emerald-200/60 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Inquire via WhatsApp</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor / Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Industrial Supplies Ltd"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Person
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe (Account Manager)"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="e.g. +923001234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="supplier@company.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address / Warehouse</label>
                <input
                  type="text"
                  placeholder="City, Industrial Area..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes &amp; Catalog Terms</label>
                <textarea
                  rows={2}
                  placeholder="Payment terms, delivery days, minimum orders..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-xs"
                >
                  {editingVendor ? 'Save Changes' : 'Add Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Share / Contact Modal */}
      <WhatsAppShareModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        defaultTitle={`Contact ${waTargetVendor?.name || 'Vendor'}`}
        text={waTargetText}
      />
    </StockLayout>
  );
}
