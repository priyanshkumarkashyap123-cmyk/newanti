import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';

const POSTS = [
  {
    id: 'post-1',
    title: 'IS 456 Beam Design: Practical Workflow',
    excerpt: 'A practical workflow to move from load combinations to reinforcement detailing in minutes.',
    category: 'Design Codes',
    readTime: '8 min read',
    date: '11 Mar 2026',
  },
  {
    id: 'post-2',
    title: 'P-Delta Analysis Without the Headache',
    excerpt: 'When second-order effects matter, and how to verify stability in production projects.',
    category: 'Structural Analysis',
    readTime: '6 min read',
    date: '10 Mar 2026',
  },
  {
    id: 'post-3',
    title: 'From Model to Report: Faster Delivery',
    excerpt: 'How teams cut reporting time with reusable templates and auto-generated tables.',
    category: 'Tutorials',
    readTime: '5 min read',
    date: '09 Mar 2026',
  },
  {
    id: 'post-4',
    title: 'IS 800 Steel Design: Flexural-Torsional Buckling',
    excerpt: 'Clause-by-clause walkthrough of IS 800 Cl. 8.2 — when Cb matters and how BeamLab automates it.',
    category: 'Design Codes',
    readTime: '10 min read',
    date: '07 Mar 2026',
  },
  {
    id: 'post-5',
    title: 'Response Spectrum Analysis Explained',
    excerpt: 'CQC vs. SRSS modal combination — understanding the IS 1893 seismic workflow step by step.',
    category: 'Seismic Analysis',
    readTime: '9 min read',
    date: '05 Mar 2026',
  },
  {
    id: 'post-6',
    title: 'Load Path Visualisation for Multi-Storey Frames',
    excerpt: 'How colour-coded force flow diagrams reduce coordination errors in complex steel frames.',
    category: 'Tutorials',
    readTime: '7 min read',
    date: '02 Mar 2026',
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  'Design Codes': 'text-blue-500',
  'Structural Analysis': 'text-violet-500',
  'Tutorials': 'text-emerald-500',
  'Seismic Analysis': 'text-orange-500',
};

export const BlogPage = () => {
  return (
    <div className="min-h-screen bg-[#0b1326] text-slate-900 dark:text-slate-50">
      <SEO
        title="Engineering Blog"
        description="Engineering insights, design-code explainers, and product tutorials from the BeamLab team."
        path="/blog"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'BeamLab Engineering Blog',
          description: 'Structural analysis insights, IS 456/IS 800 design-code walkthroughs, and product tutorials.',
          url: 'https://beamlabultimate.tech/blog',
        }}
      />

      <section className="border-b border-[#1a2333] bg-[#0b1326]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-500 font-semibold">Resources</p>
          <h1 className="mt-3 text-4xl font-bold">Engineering Insights</h1>
          <p className="mt-4 text-[#869ab8] max-w-2xl">
            Deep dives on structural analysis, design codes, and product workflows for modern engineering teams.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <article
              key={post.id}
              className="group rounded-xl border border-[#1a2333] bg-[#0b1326] p-5 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200"
            >
              <span className={`text-xs font-semibold ${CATEGORY_COLORS[post.category] ?? 'text-blue-500'}`}>
                {post.category}
              </span>
              <h2 className="mt-2 text-lg font-semibold group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {post.title}
              </h2>
              <p className="mt-2 text-sm text-[#869ab8]">{post.excerpt}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-[#869ab8]">
                <span>{post.date}</span>
                <span>{post.readTime}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10">
          <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to home
          </Link>
        </div>
      </section>
    </div>
  );
};

export default BlogPage;

