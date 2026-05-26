import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Product, ProductReview, ReviewReply, ProductLike } from '../types';
import Header from './Header';
import Modal from './Modal';
import { 
  MessageSquare, 
  Trash2, 
  Loader2, 
  Star, 
  ThumbsUp, 
  Plus, 
  Image as ImageIcon, 
  Sparkles, 
  Send,
  CornerDownRight,
  ShieldAlert,
  Heart,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function ReviewsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [replies, setReplies] = useState<ReviewReply[]>([]);
  const [likes, setLikes] = useState<ProductLike[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal form states for Add Review
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Inline Reply states
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<number | null>(null);
  const [replyName, setReplyName] = useState('Admin Support');
  const [replyComment, setReplyComment] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Filters & Sorting
  const [filterProductId, setFilterProductId] = useState(() => {
    return localStorage.getItem('review_product_filter_id') || 'all';
  });
  const [sortBy, setSortBy] = useState<'newest' | 'likes' | 'rating-high' | 'rating-low'>('newest');
  const [ratingFilter, setRatingFilter] = useState('all');

  // Interactive Action States
  const [likeUpdatingId, setLikeUpdatingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  // Unique Device Identifier for exact Likes limitation
  const [deviceId, setDeviceId] = useState(() => {
    let devId = localStorage.getItem('device_like_id');
    if (!devId) {
      devId = 'device-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString().slice(-4);
      localStorage.setItem('device_like_id', devId);
    }
    return devId;
  });

  useEffect(() => {
    loadData();
    // Clear navigation filters from Product page click after some time
    const timer = setTimeout(() => {
      localStorage.removeItem('review_product_filter_id');
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      const loadedProducts = productsData || [];
      setProducts(loadedProducts);

      // 2. Fetch reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('product_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (reviewsError) {
        throw reviewsError;
      }

      // 3. Fetch replies
      const { data: repliesData } = await supabase
        .from('product_review_replies')
        .select('*')
        .order('created_at', { ascending: true });

      // 4. Fetch likes
      const { data: likesData } = await supabase
        .from('product_likes')
        .select('*');

      setReviews(reviewsData || []);
      setReplies(repliesData || []);
      setLikes(likesData || []);
      setUsingFallback(false);
    } catch (err) {
      console.warn('Supabase product schema tables fallback triggered. Loading local records:', err);
      setUsingFallback(true);
      
      // Load from local storage
      const localReviewsStr = localStorage.getItem('local_db_reviews');
      const localRepliesStr = localStorage.getItem('local_db_replies');
      const localLikesStr = localStorage.getItem('local_db_likes');

      setReviews(localReviewsStr ? JSON.parse(localReviewsStr) : []);
      setReplies(localRepliesStr ? JSON.parse(localRepliesStr) : []);
      setLikes(localLikesStr ? JSON.parse(localLikesStr) : []);
    } finally {
      setLoading(false);
    }
  };

  const syncLocalState = (newReviews: ProductReview[], newReplies: ReviewReply[], newLikes: ProductLike[]) => {
    setReviews(newReviews);
    setReplies(newReplies);
    setLikes(newLikes);
    localStorage.setItem('local_db_reviews', JSON.stringify(newReviews));
    localStorage.setItem('local_db_replies', JSON.stringify(newReplies));
    localStorage.setItem('local_db_likes', JSON.stringify(newLikes));
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !reviewerName.trim() || !comment.trim()) {
      alert('Please select a product and write your feedback contents.');
      return;
    }
    
    setSubmitting(true);
    const newRevObj = {
      product_id: selectedProductId,
      user_name: reviewerName.trim(),
      rating: Number(rating),
      comment: comment.trim(),
    };

    try {
      if (usingFallback) {
        const fallbackItem: ProductReview = {
          id: Date.now(),
          ...newRevObj,
          created_at: new Date().toISOString()
        };
        const newList = [fallbackItem, ...reviews];
        syncLocalState(newList, replies, likes);
      } else {
        const { error } = await supabase
          .from('product_reviews')
          .insert([newRevObj]);
        
        if (error) throw error;
        await loadData();
      }
      
      setIsModalOpen(false);
      // Reset input fields
      setReviewerName('');
      setComment('');
      setRating(5);
    } catch (err) {
      console.error('Error adding product reviews into database:', err);
      alert('Could not submit. Ensure you ran the product_reviews SQL schemas in your Supabase editor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeProduct = async (productId: string) => {
    if (likeUpdatingId) return;
    setLikeUpdatingId(productId);

    // Check if device already liked this product in local likes
    const alreadyLiked = likes.some(l => l.product_id === productId && l.user_ip === deviceId);

    try {
      if (alreadyLiked) {
        // Unlike action: delete the record
        if (usingFallback) {
          const updatedLikes = likes.filter(l => !(l.product_id === productId && l.user_ip === deviceId));
          syncLocalState(reviews, replies, updatedLikes);
        } else {
          const { error } = await supabase
            .from('product_likes')
            .delete()
            .match({ product_id: productId, user_ip: deviceId });
          
          if (error) throw error;
          await loadData();
        }
      } else {
        const newLike = {
          product_id: productId,
          user_ip: deviceId
        };
        // Like action
        if (usingFallback) {
          const fallbackLike: ProductLike = {
            id: `like-${Date.now()}`,
            ...newLike,
            created_at: new Date().toISOString()
          };
          const updatedLikes = [...likes, fallbackLike];
          syncLocalState(reviews, replies, updatedLikes);
        } else {
          const { error } = await supabase
            .from('product_likes')
            .insert([newLike]);

          if (error) throw error;
          await loadData();
        }
      }
    } catch (err) {
      console.error('Error changing product like record:', err);
    } finally {
      setLikeUpdatingId(null);
    }
  };

  const handleAddReply = async (e: React.FormEvent, reviewId: number) => {
    e.preventDefault();
    if (!replyComment.trim() || !replyName.trim()) {
      alert('Kindly fill in the reply content and your responder name.');
      return;
    }

    setSubmittingReply(true);
    const replyInsert = {
      review_id: reviewId,
      reply_user: replyName.trim(),
      reply_comment: replyComment.trim()
    };

    try {
      if (usingFallback) {
        const newRepItem: ReviewReply = {
          id: Date.now(),
          ...replyInsert,
          created_at: new Date().toISOString()
        };
        const updatedReplies = [...replies, newRepItem];
        syncLocalState(reviews, updatedReplies, likes);
      } else {
        const { error } = await supabase
          .from('product_review_replies')
          .insert([replyInsert]);

        if (error) throw error;
        await loadData();
      }

      setReplyComment('');
      setActiveReplyReviewId(null);
    } catch (err) {
      console.error('Error inserting product review reply:', err);
      alert('Could not submit reply. Running SQL code on Supabase editor ensures tables exist!');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteReview = async () => {
    if (deleteConfirmId === null) return;
    const reviewId = deleteConfirmId;
    setDeleteConfirmId(null);

    try {
      if (usingFallback) {
        const updatedReviews = reviews.filter(r => r.id !== reviewId);
        const updatedReplies = replies.filter(rep => rep.review_id !== reviewId);
        syncLocalState(updatedReviews, updatedReplies, likes);
      } else {
        const { error } = await supabase
          .from('product_reviews')
          .delete()
          .eq('id', reviewId);

        if (error) throw error;
        await loadData();
      }
    } catch (err) {
      console.error('Error deleting product review:', err);
      alert('Failed to delete review record from remote server.');
    }
  };

  // Match review with its product
  const getProductForReview = (productId: string): Product | undefined => {
    return products.find(p => p.id === productId);
  };

  // Get total likes for a product
  const getProductLikesCount = (productId: string): number => {
    return likes.filter(l => l.product_id === productId).length;
  };

  // Check if current device has liked the product
  const hasUserLikedProduct = (productId: string): boolean => {
    return likes.some(l => l.product_id === productId && l.user_ip === deviceId);
  };

  // Apply filters and sorting
  const filteredReviews = reviews.filter(review => {
    const matchesProduct = filterProductId === 'all' || review.product_id === filterProductId;
    const matchesRating = ratingFilter === 'all' || review.rating.toString() === ratingFilter;
    return matchesProduct && matchesRating;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (sortBy === 'rating-high') {
      return b.rating - a.rating;
    }
    if (sortBy === 'rating-low') {
      return a.rating - b.rating;
    }
    return 0; // Likes sorting defaults to normal when sorted by reviews
  });

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header 
        title="Product Reviews & Likes" 
        onAction={() => {
          if (products.length === 0) {
            alert('Please create at least one product first so you can assign customer reviews.');
            return;
          }
          setSelectedProductId(products[0]?.id || '');
          setIsModalOpen(true);
        }} 
        actionLabel="Post Review" 
      />

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        
        {/* Supabase Sandbox Setup Info banner */}
        {usingFallback && (
          <div className="p-5 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-900 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-805">
                <Sparkles className="w-4 h-4 text-amber-650 animate-pulse shrink-0" />
                <span>Running offline sandbox storage</span>
              </div>
              <p className="text-amber-700 font-medium">
                We're currently using local sandbox storage because the remote Supabase structure doesn't matches yet. Copy and run the query script inside <code>/supabase_schema.sql</code> in your Supabase SQL Editor to activate.
              </p>
            </div>
            <button 
              onClick={loadData}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] shrink-0 cursor-pointer transition-all active:scale-95"
            >
              Force Sync Table
            </button>
          </div>
        )}

        {/* Filters and interactive toolbar */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            
            {/* Filter by target Product */}
            <div className="flex flex-col gap-1 min-w-[220px]">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Product Select</span>
              <select
                value={filterProductId}
                onChange={(e) => setFilterProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider outline-none cursor-pointer focus:border-brand transition-colors"
                id="filter-by-product"
              >
                <option value="all">⭐ Filter By All Current Products ({products.length})</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Filter by Star Ratings */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Star Rating</span>
              <select
                value={ratingFilter}
                onChange={(e) => setRatingFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider outline-none cursor-pointer focus:border-brand transition-colors"
                id="filter-by-rating"
              >
                <option value="all">All Rating Levels</option>
                <option value="5">⭐⭐⭐⭐⭐ 5/5 Stars Only</option>
                <option value="4">⭐⭐⭐⭐ 4/5 Stars</option>
                <option value="3">⭐⭐⭐ 3/5 Stars</option>
                <option value="2">⭐⭐ 2/5 Stars</option>
                <option value="1">⭐ 1/5 Star</option>
              </select>
            </div>

            {/* Ordering direction */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sort Sequence</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider outline-none cursor-pointer focus:border-brand transition-colors"
                id="filter-sort-by"
              >
                <option value="newest">🗓️ Date: Newest Posted</option>
                <option value="rating-high">📈 Score: Highest-to-Lowest</option>
                <option value="rating-low">📉 Score: Lowest-to-Highest</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-3 flex items-center gap-3 text-xs text-slate-600 font-bold uppercase tracking-widest lg:self-end shrink-0">
            <MessageSquare className="w-4 h-4 text-brand" />
            <span>{filteredReviews.length} authenticated reviews</span>
          </div>
        </div>

        {/* Product likes counting panel showing total overview of product hearts with image */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-700">Quick Storefront Likes Index</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {products.map(p => {
              const count = getProductLikesCount(p.id);
              const userLiked = hasUserLikedProduct(p.id);
              return (
                <div 
                  key={p.id}
                  className={cn(
                    "p-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm transition-all text-center flex flex-col justify-between items-center group relative",
                    userLiked ? "border-brand-light ring-2 ring-brand/10" : ""
                  )}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 mb-2 flex items-center justify-center">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <h4 className="text-[10px] font-bold text-slate-800 line-clamp-1 w-full uppercase mb-1">{p.name}</h4>
                  <button
                    onClick={() => handleLikeProduct(p.id)}
                    className={cn(
                      "mt-1.5 w-full py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all",
                      userLiked 
                        ? "bg-red-500 text-white shadow-sm shadow-red-100" 
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    )}
                    disabled={likeUpdatingId === p.id}
                  >
                    <Heart className={cn("w-3 h-3", userLiked ? "fill-white" : "text-red-500")} />
                    <span>{count} {userLiked ? "Liked" : "Like"}</span>
                  </button>
                </div>
              );
            })}
            {products.length === 0 && (
              <p className="col-span-full text-xs text-slate-400 font-medium py-3">No products available. Create a product first.</p>
            )}
          </div>
        </div>

        {/* Main List displaying reviews & nested replies */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {filteredReviews.map((review) => {
              const matchedProduct = getProductForReview(review.product_id);
              // Filter replies for this review
              const reviewReplies = replies.filter(rep => rep.review_id === review.id);

              return (
                <div 
                  key={review.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between"
                >
                  {/* Top content wrapper */}
                  <div className="p-6 space-y-4">
                    {/* Header: matched product banner info */}
                    <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                      <div className="w-10 h-10 rounded-lg bg-white overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center">
                        {matchedProduct && matchedProduct.image ? (
                          <img 
                            src={matchedProduct.image} 
                            alt={matchedProduct.name} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-450" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[7.5px] font-black bg-[#e0e7ff] text-[#4338ca] px-2 py-0.5 rounded uppercase tracking-widest">
                          {matchedProduct ? (matchedProduct.type || 'Fulfillment') : 'Item'}
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-xs truncate mt-1">
                          {matchedProduct ? matchedProduct.name : 'Unassigned Product'}
                        </h4>
                      </div>
                    </div>

                    {/* Star ratings and comment */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn(
                              "w-3.5 h-3.5",
                              i < review.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"
                            )} 
                          />
                        ))}
                        <span className="ml-1 text-[10px] text-slate-450 font-bold">({review.rating}/5)</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-650 leading-relaxed italic">
                        "{review.comment}"
                      </p>
                    </div>

                    {/* Replies Panel (Indented nicely) */}
                    <div className="space-y-3 pt-2">
                      {reviewReplies.map((rep) => (
                        <div 
                          key={rep.id} 
                          className="flex items-start gap-2.5 pl-3 border-l-2 border-brand/20 bg-slate-50/60 p-3 rounded-r-xl"
                        >
                          <CornerDownRight className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-brand uppercase tracking-wide">
                                🛡️ {rep.reply_user}
                              </span>
                              <span className="text-[8px] text-slate-400 font-bold">
                                {rep.created_at ? format(new Date(rep.created_at), 'p') : 'Just now'}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                              {rep.reply_comment}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline Reply input display toggle */}
                    {activeReplyReviewId === review.id ? (
                      <form 
                        onSubmit={(e) => handleAddReply(e, review.id)} 
                        className="p-4 bg-[#f8fafc] border border-slate-200 rounded-xl space-y-3 font-sans animate-fade-in"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black bg-brand text-white px-2 py-0.5 rounded uppercase tracking-widest">
                            New Reply Form
                          </span>
                          <button 
                            type="button" 
                            onClick={() => setActiveReplyReviewId(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <input
                            required
                            type="text"
                            placeholder="Responding Representative Name..."
                            value={replyName}
                            onChange={(e) => setReplyName(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand font-bold uppercase tracking-wider text-slate-700"
                          />
                          <textarea
                            required
                            rows={2}
                            placeholder="Type support reply or store response here..."
                            value={replyComment}
                            onChange={(e) => setReplyComment(e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand font-medium text-slate-600"
                          />
                        </div>

                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setActiveReplyReviewId(null)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-250 text-[#64748b] font-black text-[9px] rounded-lg uppercase tracking-widest cursor-pointer"
                          >
                            Discard
                          </button>
                          <button
                            type="submit"
                            disabled={submittingReply}
                            className="px-4 py-1.5 bg-brand hover:bg-brand-dark text-white font-black text-[9px] rounded-lg uppercase tracking-widest flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                          >
                            {submittingReply ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Send Reply
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          setReplyComment('');
                          setActiveReplyReviewId(review.id);
                        }}
                        className="text-[9px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold uppercase px-3 py-1.5 rounded-lg border border-slate-200 tracking-widest flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Reply to Review
                      </button>
                    )}
                  </div>

                  {/* Card bottom: author metadata & trash delete button */}
                  <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-extrabold text-slate-800 uppercase tracking-widest text-[10px]">{review.user_name}</p>
                      <p className="text-[8.5px] text-slate-400 font-bold mt-0.5">
                        {review.created_at ? format(new Date(review.created_at), 'PPP') : 'Just now'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(review.id)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Customer Feedback"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredReviews.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center bg-slate-50/10 flex flex-col items-center justify-center">
                <MessageSquare className="w-12 h-12 text-slate-300 opacity-40 mb-4" />
                <p className="text-sm font-black text-slate-800 uppercase tracking-widest mb-1">No feedback recorded</p>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Be the first to leave user reviews for this layout model.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* New Review Submission Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Publish Customer Feedback Log"
      >
        <form onSubmit={handleAddReview} className="space-y-5 font-sans">
          {/* Associated Product Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">Associate Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand/20 text-xs font-bold text-slate-700 cursor-pointer"
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Reviewer User Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">User Name</label>
              <input
                required
                type="text"
                value={reviewerName}
                onChange={e => setReviewerName(e.target.value)}
                placeholder="e.g. Imran Hossain"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>

            {/* Rating Stars scale */}
            <div className="space-y-1">
              <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">Rating Score</label>
              <select
                value={rating}
                onChange={e => setRating(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 cursor-pointer"
              >
                <option value="5">⭐⭐⭐⭐⭐ 5/5 Stars</option>
                <option value="4">⭐⭐⭐⭐ 4/5 Stars</option>
                <option value="3">⭐⭐⭐ 3/5 Stars</option>
                <option value="2">⭐⭐ 2/5 Stars</option>
                <option value="1">⭐ 1/5 Star</option>
              </select>
            </div>
          </div>

          {/* Comment text description */}
          <div className="space-y-1">
            <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase block">Feedback Content</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="What was the experience with this product?"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600 focus:outline-none"
            />
          </div>

          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-5 py-3 rounded-xl border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-[2] px-5 py-3 rounded-xl bg-brand text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Publish Review
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <Modal
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove Review Entry?"
      >
        <div className="space-y-6">
          <p className="text-xs font-extrabold text-slate-600 uppercase tracking-widest leading-relaxed">
            Are you absolutely sure you want to permanently delete this customer review log? Any nested responses will also be removed.
          </p>
          <div className="flex gap-4">
            <button
              onClick={handleDeleteReview}
              className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
            >
              Permanently Delete
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Keep Record
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
