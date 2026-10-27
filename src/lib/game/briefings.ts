import type { CaseId, Role } from "./types";

export const CLIENTSAFE = [
  {
    id: "fest-fund",
    title: "The Missing Fest Fund",
    summary: "The ₹48,000 fest fund disappeared during a 20:40–21:00 finance-office access window.",
  },
  {
    id: "exam-leak",
    title: "The Exam Paper Leak",
    summary: "An exam paper was allegedly distributed before the exam after access and printing activity linked to you.",
  },
  {
    id: "missing-trophy",
    title: "The Missing Trophy",
    summary: "A trophy disappeared from the event display after access and equipment movement linked to you.",
  },
] as const satisfies readonly { id: CaseId; title: string; summary: string }[];

export const CASE_OPTIONS = CLIENTSAFE;

export const CASE_BRIEFINGS: Record<CaseId, Record<Role, readonly [string, string]>> = {
  "fest-fund": {
    innocent: [
      "You did not take the money. You were collecting stage equipment in the West Annex, used your authorized finance-office access, and printed a cash-count sheet at the treasurer's request. The red folder held stage paperwork; the shared crate was ordinary stage logistics. Explain your evening clearly and keep the details consistent.",
      "You are innocent. You went to the West Annex for stage logistics, opened Finance with permission, and printed the cash-count sheet because the treasurer asked you to. Your red folder contained event paperwork, and the shared crate was used by several volunteers. Explain only what you know and keep the timeline consistent.",
    ],
    guilty: [
      "You took ₹48,000 during an authorized West Annex access window. A legitimate equipment errand and the treasurer-requested cash-count sheet print give you a plausible cover. Explain what happened without volunteering more than the evidence forces you to.",
      "You stole the ₹48,000 during the finance-office window. You used a real equipment errand, a real card access, and a real print request as cover. Keep your account narrow while explaining the presence, access, folder, print job, and crate.",
    ],
  },
  "exam-leak": {
    innocent: [
      "You did not distribute an exam paper. The examination office authorized you to print twelve sealed duplicate packets for secure storage, and your supervisor knew you were in the copy room. The envelope held attendance paperwork; explain the authorized visit and keep the account consistent.",
      "You are innocent. You were checking the copier and completing an approved archive print run before the exam. Your account stayed logged in while the packets were handled, and the sealed envelope was an unrelated office delivery. Explain your presence, access, and actions without inventing a recipient.",
    ],
    guilty: [
      "You copied the exam paper before the exam and handed packets to a recipient. Your badge and account activity are genuine, and the jacket description is yours. Explain your presence, access, envelope, and printing without volunteering more than the evidence forces you to.",
      "You used an authorized-looking print-room visit to duplicate the exam paper and pass it through the loading corridor. The recipient message points to your distribution. Keep the account narrow while explaining the corridor, copy-room access, envelope, and packets.",
    ],
  },
  "missing-trophy": {
    innocent: [
      "You did not remove the trophy. Event staff authorized you to inventory the display and move a padded case of lighting equipment; your display access and service-crate checkout were legitimate. The shared cart was used by several staff. Explain your tasks and keep the timeline consistent.",
      "You are innocent. You were helping facilities move display supplies after an approved cabinet check. The padded case held equipment, the service crate carried event materials, and the generic glove was already in a shared cart. Explain your presence, access, and movements without guessing who took the trophy.",
    ],
    guilty: [
      "You opened the display and removed the trophy, hiding it among the service equipment before leaving. The padded case, your crate checkout, and the shared cart are part of the cover. Explain the presence, access, case, and crate without volunteering more than the evidence forces you to.",
      "You took the trophy during the event and used the padded case and service crate to move it toward the loading door. The generic glove and empty display now fit your actions. Keep your account narrow while explaining the gallery, cabinet, case, and crate.",
    ],
  },
};

// Legacy aliases use the first fest-fund briefing variant.
export const BRIEFINGS: Record<Role, string> = {
  innocent: CASE_BRIEFINGS["fest-fund"].innocent[0],
  guilty: CASE_BRIEFINGS["fest-fund"].guilty[0],
};
