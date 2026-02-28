
import React from 'react';
import { BookInterface } from './BookInterface';

/**
 * Book-style Application Wrapper
 * 
 * This component provides a book-style interface for the Civil Engineering
 * Design & Analysis documentation. It presents content in an interactive
 * book format with:
 * 
 * - Cover page with title and author
 * - Introduction/Preface page
 * - Table of Contents with clickable navigation
 * - Detailed chapter pages for each engineering discipline
 * - Appendix with quick reference materials
 * 
 * Navigation:
 * - Click arrows or edges to turn pages
 * - Use keyboard arrows (← →) for navigation
 * - Click page indicator dots for quick access
 * - Home/End keys for first/last page
 * 
 * @example
 * ```tsx
 * import { BookApp } from './components/BookApp';
 * 
 * function App() {
 *   return <BookApp />;
 * }
 * ```
 */
export const BookApp: React.FC = () => {
  return (
    <div className="min-h-screen w-full">
      <BookInterface />
    </div>
  );
};

export default BookApp;
