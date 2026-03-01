/**
 * FeedbackWidget.tsx
 * 
 * In-app feedback collection widget
 * Allows users to report bugs, suggest features, and rate experience
 */

import { FC, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  X, 
  Bug, 
  Lightbulb, 
  HelpCircle,
  Star,
  Send,
  CheckCircle,
  Camera
} from 'lucide-react';
import { useAnalytics, ANALYTICS_EVENTS } from '../../providers/AnalyticsProvider';

// ============================================
// TYPES
// ============================================

type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackData {
  type: FeedbackType;
  message: string;
  rating?: number;
  email?: string;
  screenshot?: string;
  url: string;
  timestamp: Date;
  userAgent: string;
}

// ============================================
// FEEDBACK WIDGET COMPONENT
// ============================================

interface FeedbackWidgetProps {
  position?: 'bottom-right' | 'bottom-left';
}

export const FeedbackWidget: FC<FeedbackWidgetProps> = ({ position = 'bottom-right' }) => {
  const { track } = useAnalytics();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'type' | 'form' | 'success'>('type');
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const feedbackTypes = [
    { id: 'bug', label: 'Report a Bug', icon: Bug, color: 'red' },
    { id: 'feature', label: 'Suggest Feature', icon: Lightbulb, color: 'amber' },
    { id: 'question', label: 'Ask a Question', icon: HelpCircle, color: 'blue' },
    { id: 'other', label: 'General Feedback', icon: MessageSquare, color: 'purple' },
  ] as const;

  const handleOpen = () => {
    setIsOpen(true);
    track(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, { action: 'opened' });
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('type');
    setMessage('');
    setRating(null);
    setEmail('');
  };

  const handleSelectType = (type: FeedbackType) => {
    setFeedbackType(type);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      type: feedbackType,
      message,
      rating: rating || undefined,
      email: email || undefined,
      url: window.location.href,
      timestamp: new Date(),
      userAgent: navigator.userAgent
    };

    try {
      // In production, send to your feedback service
      // await fetch('/api/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(feedbackData)
      // });

      // Store locally for now
      const feedback = JSON.parse(localStorage.getItem('user_feedback') || '[]');
      feedback.push(feedbackData);
      localStorage.setItem('user_feedback', JSON.stringify(feedback));

      track(ANALYTICS_EVENTS.FEEDBACK_SUBMITTED, { 
        type: feedbackType,
        hasRating: !!rating,
        hasEmail: !!email
      });

      setStep('success');
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const positionClasses = position === 'bottom-right' 
    ? 'right-6 bottom-6' 
    : 'left-6 bottom-6';

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className={`fixed ${positionClasses} z-50 w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center text-white`}
        aria-label="Send feedback"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Feedback Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed ${positionClasses} z-50 w-96 max-w-[calc(100vw-3rem)] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {step === 'type' && 'Send Feedback'}
                {step === 'form' && feedbackTypes.find(t => t.id === feedbackType)?.label}
                {step === 'success' && 'Thank You!'}
              </h3>
              <button
                onClick={handleClose}
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              {/* Step 1: Select Type */}
              {step === 'type' && (
                <div className="grid grid-cols-2 gap-3">
                  {feedbackTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type.id)}
                      className="flex flex-col items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-all group"
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        type.color === 'red' ? 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20' :
                        type.color === 'amber' ? 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/20' :
                        type.color === 'blue' ? 'bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20' :
                        'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20'
                      }`}>
                        <type.icon className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{type.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Feedback Form */}
              {step === 'form' && (
                <div className="space-y-4">
                  {/* Message */}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                      {feedbackType === 'bug' ? 'Describe the issue' : 
                       feedbackType === 'feature' ? 'Describe your idea' :
                       feedbackType === 'question' ? 'What would you like to know?' :
                       'Your feedback'}
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        feedbackType === 'bug' ? 'What happened? What did you expect?' :
                        feedbackType === 'feature' ? 'What feature would help you?' :
                        feedbackType === 'question' ? 'Type your question here...' :
                        'Share your thoughts...'
                      }
                      className="w-full h-28 px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Rating (for feature/other) */}
                  {(feedbackType === 'feature' || feedbackType === 'other') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                        How important is this to you?
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className="p-1 transition-transform hover:scale-110"
                          >
                            <Star 
                              className={`w-6 h-6 ${
                                rating && star <= rating 
                                  ? 'text-amber-400 fill-amber-400' 
                                  : 'text-slate-500'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Email (optional) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                      Email (optional, for follow-up)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep('type')}
                      className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!message.trim() || isSubmitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Submit
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {step === 'success' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    Feedback Received!
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                    Thanks for helping us improve BeamLab. We read every piece of feedback.
                  </p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FeedbackWidget;
