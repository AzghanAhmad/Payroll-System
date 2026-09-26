import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  FolderTree,
  X,
  Search,
} from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import { stockApi } from '@/services';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    parentCategory: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock-categories'],
    queryFn: stockApi.listCategories,
  });

  const [isCreatingNewParent, setIsCreatingNewParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');

  const categories = data?.items || [];

  const quickParentMutation = useMutation({
    mutationFn: (name) => stockApi.createCategory({ name, parentCategory: null }),
    onSuccess: (newCat) => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      toast.success(`Parent category "${newCat.name}" created`);
      setForm((prev) => ({ ...prev, parentCategory: newCat._id }));
      setIsCreatingNewParent(false);
      setNewParentName('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating parent category'),
  });

  const handleQuickCreateParent = () => {
    if (!newParentName.trim()) return toast.error('Parent category name is required');
    quickParentMutation.mutate(newParentName.trim());
  };

  const createMutation = useMutation({
    mutationFn: stockApi.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      toast.success('Category created');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error creating category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => stockApi.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      toast.success('Category updated');
      closeModal();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error updating category'),
  });

  const deleteMutation = useMutation({
    mutationFn: stockApi.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-categories'] });
      toast.success('Category removed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error deleting category'),
  });

  const openModal = (cat = null) => {
    if (cat) {
      setEditingCategory(cat);
      setForm({
        name: cat.name || '',
        description: cat.description || '',
        parentCategory: cat.parentCategory?._id || cat.parentCategory || '',
      });
    } else {
      setEditingCategory(null);
      setForm({ name: '', description: '', parentCategory: '' });
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      parentCategory: form.parentCategory || null,
    };

    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory._id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <StockLayout title="Category Management">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Product Categories</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Organize inventory into main categories and subcategories.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories..."
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
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((cat) => (
          <div
            key={cat._id}
            className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-sky-300 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openModal(cat)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete category "${cat.name}"?`)) {
                        deleteMutation.mutate(cat._id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-base mt-3">{cat.name}</h3>
              <p className="text-slate-500 text-xs mt-1 line-clamp-2">
                {cat.description || 'No description provided.'}
              </p>
            </div>

            {cat.parentCategory && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] text-slate-400">Parent:</span>
                <span className="font-semibold text-slate-700">{cat.parentCategory.name}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </h3>
              <button onClick={closeModal} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Raw Materials, Electronics, Packaging"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Parent Category (Optional)
                  </label>
                  {!isCreatingNewParent ? (
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewParent(true)}
                      className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      Add New Parent Category
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingNewParent(false);
                        setNewParentName('');
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {isCreatingNewParent ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type new parent category name..."
                      value={newParentName}
                      onChange={(e) => setNewParentName(e.target.value)}
                      className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-sky-300 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-sky-50/30"
                    />
                    <button
                      type="button"
                      onClick={handleQuickCreateParent}
                      disabled={!newParentName.trim() || quickParentMutation.isPending}
                      className="px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs rounded-xl disabled:bg-slate-200 transition-colors"
                    >
                      {quickParentMutation.isPending ? '...' : 'Add'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={form.parentCategory}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setIsCreatingNewParent(true);
                      } else {
                        setForm({ ...form, parentCategory: e.target.value });
                      }
                    }}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                  >
                    <option value="">None (Top-level parent category)</option>
                    <option value="__add_new__" className="font-semibold text-sky-600">
                      Create New Parent Category...
                    </option>
                    <optgroup label="Existing Categories">
                      {categories
                        .filter((c) => !editingCategory || c._id !== editingCategory._id)
                        .map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Assign to nest under a main department or raw material group.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Notes or details about this product category..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                  {editingCategory ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </StockLayout>
  );
}
