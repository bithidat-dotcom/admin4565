import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Review } from '../types';
import Header from '../components/Header';
import Modal from '../components/Modal';
import { Star, Trash2, Loader2, MessageSquare } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reviewsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as Review[];
      
      setReviews(reviewsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reviews');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;
    const id = reviewToDelete;
    setReviewToDelete(null);
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'reviews', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-3 h-3",
              star <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-x-hidden">
      <Header title="Customer Reviews" />

      <main className="p-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-brand animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div 
                key={review.id} 
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-sm">
                      {review.customer_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-sm tracking-tight">{review.customer_name}</h3>
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <button
                    onClick={() => setReviewToDelete(review.id)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1">
                  {review.product_name && (
                    <div className="mb-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 inline-block px-2 py-0.5 rounded">
                      Product: {review.product_name}
                    </div>
                  )}
                  <p className="text-slate-600 text-xs leading-relaxed italic">
                    "{review.comment}"
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-brand uppercase tracking-widest">
                    <MessageSquare className="w-3 h-3" />
                    Verified Feedback
                  </div>
                </div>

                {deletingId === review.id && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-2xl flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 text-brand animate-spin" />
                  </div>
                )}
              </div>
            ))}

            {reviews.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-500 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No reviews found in stream</p>
                <p className="text-sm">Customer feedback will appear here as they are submitted.</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Modal
        isOpen={reviewToDelete !== null}
        onClose={() => setReviewToDelete(null)}
        title="Delete Review?"
      >
        <div className="space-y-6">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide leading-relaxed">
            Are you sure you want to delete this customer review? This action cannot be undone.
          </p>
          <div className="flex gap-4">
            <button
              onClick={confirmDeleteReview}
              className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 active:scale-98 transition-all text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-100 cursor-pointer"
            >
              Confirm Delete
            </button>
            <button
              onClick={() => setReviewToDelete(null)}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-98 transition-all text-slate-600 text-xs font-black uppercase tracking-widest rounded-xl cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
