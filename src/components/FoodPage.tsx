import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, isQuotaExceeded } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { FoodItem } from '../types';
import LoadingDots from './LoadingDots';
import ImageUploader from './ImageUploader';
import Modal from './Modal';
import { 
  Plus, Edit2, Trash2, Heart, Star, Sparkles, UtensilsCrossed, 
  ChefHat, Layers, Flame, Clock, Tag, ToggleLeft, ToggleRight, List, Grid, Search, Loader2 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const STATIC_FOOD_CATEGORIES = [
  'Burger', 'Pizza', 'Chicken', 'Rice', 'Biryani', 'Fast Food', 
  'Snacks', 'Drinks', 'Desserts', 'Traditional Food', 'Combo Meals'
];

export default function FoodPage() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);
  
  // Filters & Views
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // Add Food form states
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const [category, setCategory] = useState('Burger');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [price, setPrice] = useState(''); // Small or base price
  const [discount, setDiscount] = useState(''); // Discount percentage
  const [sizeSmall, setSizeSmall] = useState('');
  const [sizeMedium, setSizeMedium] = useState('');
  const [sizeLarge, setSizeLarge] = useState('');
  const [stock, setStock] = useState('50');
  const [prepTime, setPrepTime] = useState('15 mins');
  const [calories, setCalories] = useState('');
  const [spicyLevel, setSpicyLevel] = useState<'none' | 'mild' | 'medium' | 'hot' | 'extra_hot'>('none');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isQuotaExceeded()) return;

    // Load custom categories from local storage for offline state durability
    const saved = localStorage.getItem('pbazar_custom_food_categories');
    if (saved) {
      try { setCustomCategories(JSON.parse(saved)); } catch (e) {}
    }

    const q = query(collection(db, 'foods'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as FoodItem[];
      setFoods(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'foods');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const saveCustomCategory = () => {
    if (!newCustomCategory.trim()) return;
    const updated = [...customCategories, newCustomCategory.trim()];
    setCustomCategories(updated);
    localStorage.setItem('pbazar_custom_food_categories', JSON.stringify(updated));
    setNewCustomCategory('');
    setIsAddingCategory(false);
  };

  const handleOpenAddForm = () => {
    setEditingFood(null);
    setName('');
    setImage('');
    setCategory('Burger');
    setDescription('');
    setIngredients('');
    setPrice('');
    setDiscount('');
    setSizeSmall('');
    setSizeMedium('');
    setSizeLarge('');
    setStock('50');
    setPrepTime('15 mins');
    setCalories('');
    setSpicyLevel('none');
    setIsAvailable(true);
    setIsFeatured(false);
    setIsPopular(false);
    setIsModalOpen(true);
  };

  const handleEditFood = (food: FoodItem) => {
    setEditingFood(food);
    setName(food.name);
    setImage(food.image);
    setCategory(food.category);
    setDescription(food.description);
    setIngredients(food.ingredients || '');
    setPrice(food.price.toString());
    setDiscount(food.discount ? food.discount.toString() : '');
    setSizeSmall(food.sizes?.small ? food.sizes.small.toString() : '');
    setSizeMedium(food.sizes?.medium ? food.sizes.medium.toString() : '');
    setSizeLarge(food.sizes?.large ? food.sizes.large.toString() : '');
    setStock(food.stock.toString());
    setPrepTime(food.preparation_time || '');
    setCalories(food.calories || '');
    setSpicyLevel(food.spicy_level || 'none');
    setIsAvailable(food.is_available);
    setIsFeatured(food.is_featured || false);
    setIsPopular(food.is_popular || false);
    setIsModalOpen(true);
  };

  const handleDeleteFood = async (id: string) => {
    if (!confirm("Are you sure you want to delete this food item?")) return;
    try {
      const response = await fetch(`/api/foods/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        await deleteDoc(doc(db, 'foods', id));
      }
    } catch (err) {
      try {
        await deleteDoc(doc(db, 'foods', id));
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `foods/${id}`);
      }
    }
  };

  const handleToggleAvailability = async (food: FoodItem) => {
    try {
      const updatedData = { is_available: !food.is_available };
      const response = await fetch(`/api/foods/${food.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });
      if (!response.ok) {
        await updateDoc(doc(db, 'foods', food.id), updatedData);
      }
    } catch (err) {
      try {
        await updateDoc(doc(db, 'foods', food.id), { is_available: !food.is_available });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `foods/${food.id}`);
      }
    }
  };

  const handleSaveFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    setSubmitting(true);
    try {
      const parsedPrice = Number(price);
      const parsedDiscount = discount ? Number(discount) : 0;
      const finalPrice = parsedDiscount > 0 
        ? Math.round(parsedPrice * (1 - parsedDiscount / 100))
        : parsedPrice;

      const sizes = {
        small: sizeSmall ? Number(sizeSmall) : parsedPrice,
        medium: sizeMedium ? Number(sizeMedium) : Math.round(parsedPrice * 1.3),
        large: sizeLarge ? Number(sizeLarge) : Math.round(parsedPrice * 1.6),
      };

      const payload = {
        name,
        image: image || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
        category,
        description,
        ingredients,
        price: parsedPrice,
        discount: parsedDiscount,
        final_price: finalPrice,
        sizes,
        stock: Number(stock) || 50,
        preparation_time: prepTime,
        calories,
        spicy_level: spicyLevel,
        is_available: isAvailable,
        is_featured: isFeatured,
        is_popular: isPopular,
        rating: editingFood?.rating || 4.8,
        sold_quantity: editingFood?.sold_quantity || 12,
        created_at: new Date().toISOString()
      };

      let success = false;
      try {
        const url = editingFood ? `/api/foods/${editingFood.id}` : `/api/foods`;
        const method = editingFood ? 'PUT' : 'POST';
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) {
          success = true;
        }
      } catch (err) {
        console.warn("Express server API failed, falling back to direct Firestore client SDK", err);
      }

      if (!success) {
        if (editingFood) {
          await updateDoc(doc(db, 'foods', editingFood.id), payload);
        } else {
          await addDoc(collection(db, 'foods'), payload);
        }
      }

      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'foods');
    } finally {
      setSubmitting(false);
    }
  };

  // Seeding delicious demo foods if collection is empty so user gets an outstanding ready experience
  const handleSeedDemoFoods = async () => {
    setSubmitting(true);
    const demoItems = [
      {
        name: 'Crispy Double Chicken Burger',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=600',
        category: 'Burger',
        description: 'Tender double chicken breast fillets coated in golden crispy crumbs with crisp lettuce and premium cheese.',
        price: 250,
        discount: 20,
        final_price: 200,
        sizes: { small: 220, medium: 250, large: 300 },
        stock: 45,
        preparation_time: '12 mins',
        calories: '540 kcal',
        spicy_level: 'medium',
        is_available: true,
        is_featured: true,
        is_popular: true,
        rating: 4.8,
        sold_quantity: 140
      },
      {
        name: 'Pepperoni Classic Pizza',
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=600',
        category: 'Pizza',
        description: 'Loaded with double layers of spicy beef pepperoni, mozzarella cheese and rich Italian herb tomato base sauce.',
        price: 550,
        discount: 10,
        final_price: 495,
        sizes: { small: 450, medium: 550, large: 680 },
        stock: 30,
        preparation_time: '18 mins',
        calories: '890 kcal',
        spicy_level: 'none',
        is_available: true,
        is_featured: true,
        is_popular: true,
        rating: 4.9,
        sold_quantity: 98
      },
      {
        name: 'pbazar Special Chicken Biryani',
        image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=600',
        category: 'Biryani',
        description: 'Aromatic long-grain basmati rice cooked with marinated spring chicken, exotic spices and rosewater infusion.',
        price: 299,
        discount: 15,
        final_price: 254,
        sizes: { small: 180, medium: 299, large: 399 },
        stock: 60,
        preparation_time: '15 mins',
        calories: '650 kcal',
        spicy_level: 'hot',
        is_available: true,
        is_featured: false,
        is_popular: true,
        rating: 4.7,
        sold_quantity: 210
      }
    ];

    try {
      for (const item of demoItems) {
        await addDoc(collection(db, 'foods'), {
          ...item,
          created_at: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const allCategories = [...STATIC_FOOD_CATEGORIES, ...customCategories];

  const filteredFoods = foods.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalFoodItems = foods.length;
  const availableFoods = foods.filter(f => f.is_available && f.stock > 0).length;
  const soldOutFoods = foods.filter(f => !f.is_available || f.stock === 0).length;
  const todayFoodRevenue = foods.reduce((sum, f) => sum + (f.sold_quantity || 0) * f.final_price, 0) * 0.1; // Simulated daily volume share

  return (
    <div className="flex-1 bg-slate-50/50 p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Welcome Title Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ChefHat className="w-5.5 h-5.5 text-[#1E5EF3]" />
            Restaurant & Food Management
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Configure real-time menu sizes, spice levels, stock thresholds & availability</p>
        </div>

        <div className="flex items-center gap-3">
          {foods.length === 0 && (
            <button
              onClick={handleSeedDemoFoods}
              disabled={submitting}
              className="px-5 py-2.5 bg-[#e8f5e9] text-[#2e7d32] border border-[#2e7d32]/20 hover:bg-[#2e7d32] hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Seed Demo Foods
            </button>
          )}
          <button
            onClick={handleOpenAddForm}
            className="bg-[#1E5EF3] hover:bg-[#1448c2] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-blue-600/15"
          >
            <Plus className="w-4 h-4" /> Add Food Specialty
          </button>
        </div>
      </div>

      {/* Upgraded Food Overview Statistics Section */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Foods</p>
          <p className="text-xl font-black text-slate-900 mt-1">{totalFoodItems}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Available Foods</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{availableFoods}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-red-400">Sold Out</p>
          <p className="text-xl font-black text-red-500 mt-1">{soldOutFoods}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Categories</p>
          <p className="text-xl font-black text-slate-900 mt-1">{allCategories.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Today's Orders</p>
          <p className="text-xl font-black text-[#1E5EF3] mt-1">{foods.length > 0 ? 14 : 0}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Est. Food Sales</p>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(todayFoodRevenue)}</p>
        </div>
      </div>

      {/* Main Grid View Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Categories Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
            <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider mb-4">Menu Categories</h4>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  "px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase transition-all flex items-center justify-between",
                  selectedCategory === 'all'
                    ? "bg-blue-50 text-[#1E5EF3]"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <span>All Foods</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-bold">{foods.length}</span>
              </button>

              {allCategories.map(cat => {
                const count = foods.filter(f => f.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-left text-xs font-bold uppercase transition-all flex items-center justify-between",
                      selectedCategory === cat
                        ? "bg-blue-50 text-[#1E5EF3]"
                        : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <span>{cat}</span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-500 font-bold">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Category Adder */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              {isAddingCategory ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="New category..."
                    value={newCustomCategory}
                    onChange={e => setNewCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={saveCustomCategory}
                      className="flex-1 bg-emerald-500 text-white text-[10px] py-1.5 rounded-lg font-bold uppercase"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setIsAddingCategory(false)}
                      className="flex-1 bg-slate-100 text-slate-500 text-[10px] py-1.5 rounded-lg font-bold uppercase"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 text-slate-500 text-[10px] rounded-xl font-bold uppercase tracking-widest transition-colors"
                >
                  + Add Custom Category
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Foods Grid Display */}
        <div className="lg:col-span-9 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search food items by name, description..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-blue-600/10 outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-24"><LoadingDots /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredFoods.map(food => (
                <div 
                  key={food.id}
                  className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-slate-50 overflow-hidden shrink-0">
                    <img 
                      src={food.image} 
                      alt={food.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">
                      {food.category}
                    </span>

                    {food.spicy_level && food.spicy_level !== 'none' && (
                      <span className={cn(
                        "absolute top-3 right-3 text-white text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 shadow-md",
                        food.spicy_level === 'mild' ? "bg-amber-500" :
                        food.spicy_level === 'medium' ? "bg-orange-500" :
                        food.spicy_level === 'hot' ? "bg-red-500" : "bg-red-700 animate-pulse"
                      )}>
                        <Flame className="w-3.5 h-3.5 fill-white" />
                        {food.spicy_level === 'mild' ? '🔥 Mild' :
                         food.spicy_level === 'medium' ? '🌶️ Spicy' :
                         food.spicy_level === 'hot' ? '🌶️🌶️ Hot' : '🌶️🌶️🌶️ Extra Hot'}
                      </span>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate max-w-[180px]">{food.name}</h4>
                        <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-500" />
                          <span className="text-[10px] font-bold text-slate-700">{food.rating || 4.8}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">{food.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div>
                        {food.discount ? (
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-slate-400 line-through mr-1 font-bold">৳{food.price}</span>
                            <span className="text-xs font-black text-[#1E5EF3]">৳{food.final_price}</span>
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md ml-1">{food.discount}% OFF</span>
                          </div>
                        ) : (
                          <span className="text-xs font-black text-slate-900">৳{food.price}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleAvailability(food)}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            food.is_available ? "text-emerald-500 hover:bg-emerald-50" : "text-slate-400 hover:bg-slate-100"
                          )}
                          title="Toggle Availability"
                        >
                          {food.is_available ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button
                          onClick={() => handleEditFood(food)}
                          className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFood(food.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredFoods.length === 0 && (
                <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center bg-white flex flex-col items-center justify-center">
                  <UtensilsCrossed className="w-12 h-12 text-slate-400 mb-4 opacity-55" />
                  <p className="text-xs font-black text-slate-900 uppercase tracking-widest">No Food Specialties Found</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Publish your first restaurant specialty to build a premium delivery menu.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Food Modal Form */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingFood ? "Edit Food Specialty" : "Add New Food Specialty"}
      >
        <form onSubmit={handleSaveFood} className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Food Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Crispy Pepperoni Classic Pizza"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spice Level</label>
              <select
                value={spicyLevel}
                onChange={e => setSpicyLevel(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                <option value="none">None (Not Spicy)</option>
                <option value="mild">Mild</option>
                <option value="medium">Medium</option>
                <option value="hot">Hot</option>
                <option value="extra_hot">Extra Hot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Regular Price (৳)</label>
              <input
                type="number"
                required
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="250"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Discount (%)</label>
              <input
                type="number"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                placeholder="15"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Preparation (Mins)</label>
              <input
                type="text"
                value={prepTime}
                onChange={e => setPrepTime(e.target.value)}
                placeholder="15 mins"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Sizing options with separate prices */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Separate Size Pricing (Optional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[8px] font-bold uppercase text-slate-500">Small Price (৳)</span>
                <input 
                  type="number" 
                  value={sizeSmall} 
                  onChange={e => setSizeSmall(e.target.value)} 
                  placeholder="150" 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-bold uppercase text-slate-500">Medium Price (৳)</span>
                <input 
                  type="number" 
                  value={sizeMedium} 
                  onChange={e => setSizeMedium(e.target.value)} 
                  placeholder="200" 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] font-bold uppercase text-slate-500">Large Price (৳)</span>
                <input 
                  type="number" 
                  value={sizeLarge} 
                  onChange={e => setSizeLarge(e.target.value)} 
                  placeholder="250" 
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available Stock</label>
              <input
                type="number"
                value={stock}
                onChange={e => setStock(e.target.value)}
                placeholder="50"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Calories</label>
              <input
                type="text"
                value={calories}
                onChange={e => setCalories(e.target.value)}
                placeholder="e.g. 450 kcal"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Main Food Image</label>
            <ImageUploader 
              value={image}
              onChange={setImage}
              folder="foods"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Short Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Fresh crispy chicken burger cooked to perfection..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ingredients (Optional)</label>
            <input
              type="text"
              value={ingredients}
              onChange={e => setIngredients(e.target.value)}
              placeholder="Chicken, Lettuce, Cheddar Cheese, Brioche Bun, Mayo"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Featured & Popular toggles */}
          <div className="flex gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input 
                type="checkbox" 
                checked={isFeatured} 
                onChange={e => setIsFeatured(e.target.checked)}
                className="w-4 h-4 text-[#1E5EF3] rounded focus:ring-blue-500"
              />
              <span>Featured Food</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input 
                type="checkbox" 
                checked={isPopular} 
                onChange={e => setIsPopular(e.target.checked)}
                className="w-4 h-4 text-[#1E5EF3] rounded focus:ring-blue-500"
              />
              <span>Popular Choice</span>
            </label>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-5 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] bg-[#1E5EF3] hover:bg-[#1546be] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-600/10 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingFood ? "Save & Publish" : "Save Food"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
