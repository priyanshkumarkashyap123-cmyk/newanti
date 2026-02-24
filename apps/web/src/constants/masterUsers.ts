/**
 * Master User Configuration
 * Users in this list get enterprise-level access regardless of subscription
 */

export const MASTER_EMAILS: ReadonlyArray<string> = [
    'rakshittiwari048@gmail.com',
];

/**
 * Check if email belongs to a master user
 */
export function isMasterUser(email: string | null | undefined): boolean {
    if (!email) return false;
    return MASTER_EMAILS.includes(email.toLowerCase().trim());
}
