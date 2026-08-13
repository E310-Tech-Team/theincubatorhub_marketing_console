/*
 * Single source of truth for plain-language definitions. Used by the Glossary
 * dialog, the Help page, and every <HelpHint term="…"/> so wording stays
 * consistent everywhere. Keep definitions to one sentence; `why` is an optional
 * "why it matters" line.
 */
export interface GlossaryTerm {
  /** Stable key, also used by <HelpHint term="…"/>. */
  id: string;
  term: string;
  definition: string;
  why?: string;
}

export const glossary: GlossaryTerm[] = [
  {
    id: 'campaign',
    term: 'Campaign',
    definition: 'One email you send to an audience, with tracked links and results.',
    why: 'The campaign is the thing you build, preview, test, and send.',
  },
  {
    id: 'audience',
    term: 'Audience',
    definition: 'A group of people to send a campaign to, built from filters.',
    why: 'Sending to the right audience keeps your email relevant and your open rates high.',
  },
  {
    id: 'contact',
    term: 'Contact',
    definition: "A person you can email who isn't an app user yet — a lead.",
    why: 'Contacts are your imported or signed-up leads, separate from in-app users.',
  },
  {
    id: 'tracked-link',
    term: 'Tracked link',
    definition: 'A link that records who clicked it, so you can measure interest.',
    why: 'Tracked links tell you which audiences and messages actually drive action.',
  },
  {
    id: 'acquisition',
    term: 'Acquisition (bring new people)',
    definition: 'A tracked link aimed at reaching people who are new to you.',
    why: 'Grouping links this way shows how well you attract newcomers.',
  },
  {
    id: 'reengagement',
    term: 'Re-engagement',
    definition: 'A tracked link aimed at people who already know you but went quiet.',
    why: 'Re-engaging existing people is usually cheaper than finding new ones.',
  },
  {
    id: 'referral',
    term: 'Referral',
    definition: 'A tracked link for people referred by someone else.',
    why: 'Referral links measure word-of-mouth growth.',
  },
  {
    id: 'open-rate',
    term: 'Open rate',
    definition: 'The share of delivered emails that were opened.',
    why: 'A low open rate usually means the subject line or audience needs work.',
  },
  {
    id: 'click-rate',
    term: 'Click rate',
    definition: 'The share of delivered emails where someone clicked a link.',
    why: 'Clicks show real interest — not just that the email was seen.',
  },
  {
    id: 'conversion',
    term: 'Conversion',
    definition:
      'A signup completed after clicking a campaign link. It means an account was created — not that the person enrolled on a course.',
    why:
      'A signup is a lead, not the finish line. Two campaigns with identical signup counts can differ several-fold in how many learners they produce, so judge spend on the "What happened after the signup" section, which follows the same people through to enrolment.',
  },
  {
    id: 'delivery-rate',
    term: 'Delivery rate',
    definition: 'The share of sent emails that actually reached an inbox.',
    why: 'Low delivery means addresses are stale or your list needs cleaning.',
  },
  {
    id: 'bounce',
    term: 'Bounce',
    definition: "An email that couldn't be delivered (e.g. the address doesn't exist).",
    why: 'Repeatedly emailing bounces hurts your sender reputation, so they are suppressed.',
  },
  {
    id: 'complaint',
    term: 'Complaint',
    definition: 'When a recipient marks your email as spam.',
    why: 'Complaints damage deliverability for everyone, so complainers are never emailed again.',
  },
  {
    id: 'unsubscribe',
    term: 'Unsubscribe',
    definition: 'When someone opts out of your marketing email.',
    why: 'Unsubscribes are honoured automatically — you can never email them again.',
  },
  {
    id: 'consent',
    term: 'Consent',
    definition: 'A person agreeing to receive your marketing email.',
    why: 'Only emailing people who consented keeps you compliant and out of spam folders.',
  },
  {
    id: 'suppression',
    term: 'Suppression / do-not-email',
    definition: 'The list of addresses that must never be emailed (unsubscribed, bounced, complained).',
    why: 'The suppression list is enforced on every send so you can\'t reach someone who opted out.',
  },
  {
    id: 'template',
    term: 'Template / placeholder',
    definition: 'A reusable email design; placeholders like {{ first_name }} fill in each person\'s details.',
    why: 'Write the email once and it personalises itself for every recipient.',
  },
  {
    id: 'test-send',
    term: 'Test-send',
    definition: 'Sending a preview of a campaign to yourself before the real send.',
    why: 'Always test-send first to catch typos and broken links — nothing goes to your audience.',
  },
  {
    id: 'schedule',
    term: 'Schedule',
    definition: 'Setting a future date and time for a campaign to send automatically.',
    why: 'Scheduling lets you pick the best send time without being online for it.',
  },
];

const byId = new Map(glossary.map((t) => [t.id, t]));

/** Look up a term by id (used by HelpHint). */
export function glossaryTerm(id: string): GlossaryTerm | undefined {
  return byId.get(id);
}
