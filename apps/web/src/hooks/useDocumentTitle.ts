import { useEffect, useRef } from 'react';

const SITE_NAME = 'BeamLab';

/**
 * useDocumentTitle - Sets the document title and restores it on unmount.
 *
 * @param title - Page-specific title (e.g., "Dashboard"). Appended as "Dashboard | BeamLab".
 * @param options.restoreOnUnmount - Whether to restore the previous title when the component unmounts (default: true).
 */
export function useDocumentTitle(
  title: string,
  options: { restoreOnUnmount?: boolean } = {},
) {
  const { restoreOnUnmount = true } = options;
  const previousTitle = useRef(document.title);

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;
  }, [title]);

  useEffect(() => {
    const saved = previousTitle.current;
    return () => {
      if (restoreOnUnmount) {
        document.title = saved;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export default useDocumentTitle;
