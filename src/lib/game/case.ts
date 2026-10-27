import type { CaseDefinition, Evidence, Reaction, Role, Verdict, CaseId } from "./types";

export const CASE_IDS = ["fest-fund", "exam-leak", "missing-trophy"] as const satisfies readonly CaseId[];
export const CASE_VERSION = 1 as const;

const festFundEvidence: Evidence[] = [
  {
    id: "west-annex-cctv",
    round: 1,
    time: "20:42",
    title: "You in the West Annex",
    kind: "observation",
    summary: "Hallway CCTV places you in the West Annex at 20:42.",
    detail: "The hallway camera records you crossing the West Annex at 20:42. The ₹48,000 fest budget disappeared from the finance office sometime between 20:40 and 21:00.",
    limitation: "The camera establishes your presence in the hallway. It does not show the finance office interior or anyone taking money.",
    question: "Why were you there?",
    image: "/evidence/cctv.svg",
  },
  {
    id: "finance-card-access",
    round: 2,
    time: "20:47",
    title: "Your card opened Finance",
    kind: "record",
    summary: "Your access card opened the finance office at 20:47.",
    detail: "The electronic lock log records your access card opening the finance office at 20:47, inside the 20:40–21:00 window.",
    limitation: "A card record proves the card was used, not who held it at that moment.",
    question: "Explain the office access.",
    image: "/evidence/access.svg",
  },
  {
    id: "red-folder-witness",
    round: 3,
    time: "20:51",
    title: "The red-folder allegation",
    kind: "allegation",
    summary: "A witness reports seeing you carry a red folder at 20:51.",
    detail: "A volunteer says they saw you with a red folder near the finance office at 20:51. Their statement does not establish what the folder contained.",
    limitation: "The witness was across a crowded corridor and describes an impression, not a confirmed handoff or theft.",
    question: "What were you carrying?",
    image: "/evidence/witness.svg",
  },
  {
    id: "cash-count-print",
    round: 4,
    time: "20:54",
    title: "A cash-count sheet was printed",
    kind: "record",
    summary: "Your account submitted a cash-count-sheet print job at 20:54.",
    detail: "The print server links a cash-count-sheet job to your account at 20:54. The log records the document name, account and time.",
    limitation: "An account print job does not prove who stood at the printer or where the page went.",
    question: "Why were you printing financial documents?",
    image: "/evidence/printer.svg",
  },
  {
    id: "shared-crate-seal",
    round: 5,
    time: "21:02",
    title: "A red seal in the shared stage crate",
    kind: "observation",
    summary: "A generic red seal fragment was found in a shared stage crate you signed out.",
    detail: "At 21:02, staff find a generic red seal fragment in a stage crate you signed out. Several volunteers used the crate throughout the evening.",
    limitation: "The seal has no unique envelope match, serial number, or exclusive handler trail.",
    question: "Give me your final explanation.",
    image: "/evidence/seal.svg",
  },
];

const examLeakEvidence: Evidence[] = [
  {
    id: "exam-printroom-cctv",
    round: 1,
    time: "18:12",
    title: "You at the print room",
    kind: "observation",
    summary: "CCTV places you outside the exam print room at 18:12.",
    detail: "A corridor camera records you entering the print-room corridor at 18:12, before tomorrow's exam. The camera does not show what you did inside.",
    limitation: "The camera establishes presence in the corridor, not access to a paper or any later distribution.",
    question: "Why were you there?",
    image: "/evidence/cctv.svg",
  },
  {
    id: "exam-room-card-access",
    round: 2,
    time: "18:16",
    title: "Your card opened the copy room",
    kind: "record",
    summary: "Your access card opened the restricted copy room at 18:16.",
    detail: "The electronic lock log records your card opening the restricted copy room at 18:16, where exam materials are prepared.",
    limitation: "A card record proves the card was used, not who held it or what authorization they had.",
    question: "Explain the copy-room access.",
    image: "/evidence/access.svg",
  },
  {
    id: "exam-envelope-witness",
    round: 3,
    time: "18:22",
    title: "The sealed-envelope allegation",
    kind: "allegation",
    summary: "A witness reports seeing you carry a sealed envelope at 18:22.",
    detail: "A staff member says they saw you carrying a sealed envelope toward the loading corridor at 18:22. They could not identify its contents.",
    limitation: "The witness did not open the envelope or see a handoff to a student.",
    question: "What were you carrying?",
    image: "/evidence/witness.svg",
  },
  {
    id: "exam-packet-print",
    round: 4,
    time: "18:24",
    title: "Exam packets were printed",
    kind: "record",
    summary: "The print server links twelve exam packets to your account at 18:24.",
    detail: "The print server records twelve documents labelled exam packets under your account at 18:24. It does not identify the person at the terminal or the packets' destination.",
    limitation: "An account print job does not prove who ran it, whether the copies were authorized, or where they went.",
    question: "Why were you printing exam documents?",
    image: "/evidence/printer.svg",
  },
  {
    id: "exam-recipient-message",
    round: 5,
    time: "18:31",
    title: "A recipient reports an early paper",
    kind: "allegation",
    summary: "An anonymous message says an exam paper arrived before the exam at 18:31.",
    detail: "An anonymous recipient reports receiving an exam paper at 18:31 from someone wearing a jacket like yours. The message contains no verified sender identity.",
    limitation: "The message is an allegation without a verified recipient, sender, or chain of custody for the paper.",
    question: "Give me your final explanation.",
    image: "/evidence/message.svg",
  },
];

const missingTrophyEvidence: Evidence[] = [
  {
    id: "gallery-cctv",
    round: 1,
    time: "19:05",
    title: "You at the trophy gallery",
    kind: "observation",
    summary: "Gallery CCTV places you beside the trophy display at 19:05.",
    detail: "The gallery camera records you beside the trophy display at 19:05. The trophy was present earlier and was reported missing later that evening.",
    limitation: "The camera establishes your presence near the display, not removal of the trophy.",
    question: "Why were you there?",
    image: "/evidence/cctv.svg",
  },
  {
    id: "display-card-access",
    round: 2,
    time: "19:10",
    title: "Your card opened the display",
    kind: "record",
    summary: "Your access card opened the trophy display at 19:10.",
    detail: "The display lock log records your access card opening the trophy cabinet at 19:10, while the event was in progress.",
    limitation: "A card record proves the card was used, not who held it or whether the opening was authorized.",
    question: "Explain the display access.",
    image: "/evidence/access.svg",
  },
  {
    id: "padded-case-witness",
    round: 3,
    time: "19:14",
    title: "The padded-case allegation",
    kind: "allegation",
    summary: "A volunteer reports seeing you carry a padded case toward the loading door at 19:14.",
    detail: "A volunteer says they saw you carrying a padded case toward the loading door at 19:14. They did not see what was inside.",
    limitation: "The witness did not inspect the case or see a trophy placed in it.",
    question: "What were you carrying?",
    image: "/evidence/witness.svg",
  },
  {
    id: "service-crate-record",
    round: 4,
    time: "19:18",
    title: "A service crate left the gallery",
    kind: "record",
    summary: "A door sensor records a service crate leaving under your checkout at 19:18.",
    detail: "The service log records a crate leaving the gallery under your checkout at 19:18. The log does not describe the contents or who moved it.",
    limitation: "A checkout record does not prove what was in the crate or who moved it after checkout.",
    question: "Why did you move the crate?",
    image: "/evidence/crate.svg",
  },
  {
    id: "shared-cart-glove",
    round: 5,
    time: "19:25",
    title: "A glove in the shared service cart",
    kind: "observation",
    summary: "The empty plinth and a generic glove were found beside a shared service cart you signed out.",
    detail: "At 19:25, staff find the display empty and a generic glove in a shared service cart you signed out. Multiple staff used the cart during the event.",
    limitation: "The glove has no identified wearer, and the cart has no exclusive handler trail.",
    question: "Give me your final explanation.",
    image: "/evidence/glove.svg",
  },
];

const festFundReplies: Record<number, Record<Reaction, string>> = {
  1: {
    accept: "Detective Sen: An equipment errand could explain the hallway. I'll put your account on the record.",
    probe: "Detective Sen: You're circling the question. Tell me what brought you to that hallway.",
    challenge: "Detective Sen: That contradicts the camera record or what you've told me. Your timeline needs to hold together.",
    confession: "Detective Sen: That is a serious admission. I will still finish the evidence sequence before recording a verdict.",
  },
  2: {
    accept: "Detective Sen: That is a possible explanation for the access. A door opening alone doesn't establish theft.",
    probe: "Detective Sen: I need a clearer account of why your card was used. Start with what you know.",
    challenge: "Detective Sen: That explanation contradicts the access record you've given me. I'm marking the discrepancy.",
    confession: "Detective Sen: Noted. The access record remains one fact, even beside an admission.",
  },
  3: {
    accept: "Detective Sen: A folder isn't a cash envelope. Your explanation stays on the record alongside the witness statement.",
    probe: "Detective Sen: You haven't given me a clear answer about what you carried. That leaves a gap.",
    challenge: "Detective Sen: Your story has changed. The witness may be mistaken, but your own account still contradicts itself.",
    confession: "Detective Sen: I hear the admission. The witness account still needs its own evidentiary weight.",
  },
  4: {
    accept: "Detective Sen: The account requested a print. That explains a possible legitimate task.",
    probe: "Detective Sen: Explain the task behind that document. Saying it was a print job doesn't answer why.",
    challenge: "Detective Sen: That contradicts the print record or your earlier account. Another discrepancy goes in the file.",
    confession: "Detective Sen: Recorded. The print job cannot substitute for a location witness.",
  },
  5: {
    accept: "Detective Sen: A shared crate and an ordinary seal leave room for that explanation. The record is complete.",
    probe: "Detective Sen: Your final account leaves questions open. I'll weigh it with the rest of your statements.",
    challenge: "Detective Sen: The gaps in your account contradict the sequence we have. I'm closing this interview on the record.",
    confession: "Detective Sen: The sequence is complete. I will weigh the admission with the same public record.",
  },
};

const examLeakReplies: Record<number, Record<Reaction, string>> = {
  1: {
    accept: "Detective Sen: A print-room errand could explain the corridor. I'll record where you say you were going.",
    probe: "Detective Sen: Tell me what brought you to the exam print-room corridor.",
    challenge: "Detective Sen: That contradicts the corridor footage and the timing you gave me. Keep the account consistent.",
    confession: "Detective Sen: That is a serious admission. We still have to complete the evidence sequence.",
  },
  2: {
    accept: "Detective Sen: An access record can fit an authorized task. It does not by itself prove a leak.",
    probe: "Detective Sen: Explain why your card opened a restricted room before the exam.",
    challenge: "Detective Sen: Your explanation contradicts the lock record. I'm marking the access discrepancy.",
    confession: "Detective Sen: Noted. The access record remains separate from the admission.",
  },
  3: {
    accept: "Detective Sen: A sealed envelope could contain many things. Your answer stays beside the witness allegation.",
    probe: "Detective Sen: You haven't explained what you carried toward the loading corridor.",
    challenge: "Detective Sen: That contradicts your earlier account of the envelope. The witness is not the only gap now.",
    confession: "Detective Sen: I hear the admission. The witness allegation still has to be weighed on its own.",
  },
  4: {
    accept: "Detective Sen: An account print can be an authorized job. Tell me who requested it.",
    probe: "Detective Sen: Explain the purpose of twelve exam packets under your account.",
    challenge: "Detective Sen: That contradicts the print record or your earlier explanation. The discrepancy is recorded.",
    confession: "Detective Sen: Recorded. A print account alone does not identify the operator.",
  },
  5: {
    accept: "Detective Sen: The anonymous message is unverified. Your final account is on the record.",
    probe: "Detective Sen: Your final explanation leaves the alleged recipient and timing unresolved.",
    challenge: "Detective Sen: Your account contradicts the print and access sequence. I'm closing the interview on that record.",
    confession: "Detective Sen: The sequence is complete. I will weigh the admission with the same public allegations.",
  },
};

const missingTrophyReplies: Record<number, Record<Reaction, string>> = {
  1: {
    accept: "Detective Sen: An event task could explain the gallery. I'll record why you say you were there.",
    probe: "Detective Sen: Tell me what brought you beside the trophy display.",
    challenge: "Detective Sen: That contradicts the gallery footage or your timeline. Keep the account consistent.",
    confession: "Detective Sen: That is a serious admission. We still have to complete the evidence sequence.",
  },
  2: {
    accept: "Detective Sen: A display opening can fit an authorized task. It does not alone prove removal.",
    probe: "Detective Sen: Explain why your card opened the trophy display.",
    challenge: "Detective Sen: Your explanation contradicts the display lock record. I'm marking the discrepancy.",
    confession: "Detective Sen: Noted. The access record remains one fact beside the admission.",
  },
  3: {
    accept: "Detective Sen: A padded case could hold ordinary equipment. Your answer stays beside the witness allegation.",
    probe: "Detective Sen: You haven't explained what you carried toward the loading door.",
    challenge: "Detective Sen: That contradicts your earlier account of the case. The witness is not the only gap now.",
    confession: "Detective Sen: I hear the admission. The witness allegation still has its own weight.",
  },
  4: {
    accept: "Detective Sen: A crate checkout can fit event logistics. Tell me what task required it.",
    probe: "Detective Sen: Explain why the service crate left under your checkout.",
    challenge: "Detective Sen: That contradicts the service log or your earlier account. The discrepancy is recorded.",
    confession: "Detective Sen: Recorded. A checkout does not identify the crate's contents.",
  },
  5: {
    accept: "Detective Sen: A shared cart and generic glove leave room for that explanation. The record is complete.",
    probe: "Detective Sen: Your final account leaves the empty display unresolved.",
    challenge: "Detective Sen: Your account contradicts the access and movement sequence. I'm closing the interview on that record.",
    confession: "Detective Sen: The sequence is complete. I will weigh the admission with the same public record.",
  },
};

const festFundEpilogues: Record<Role, Record<Verdict, string>> = {
  innocent: {
    released: "Detective Sen closes the file. The authorized access and print request remain plausible, and the public clues never prove that you handled the missing cash.",
    under_suspicion: "You leave the interview room while Detective Sen keeps the file open. The timing is uncomfortable, but the shared access and uncorroborated clues do not settle the case.",
    caught: "In this fictional game, your explanation failed to convince Detective Sen. You were innocent, but your contradictions or admission pushed the interview to its worst ending. The suspicion score measures your story, not actual guilt.",
  },
  guilty: {
    released: "Detective Sen closes the file. Your authorized errand and the treasurer's print request give the theft a clean enough cover, and the public clues never prove the cash was in your hands.",
    under_suspicion: "You leave under a cloud. Detective Sen has a pattern worth revisiting, but the shared access and uncorroborated clues stop short of proving the theft.",
    caught: "The interview ends with the trail aligned against you. The cover story cannot absorb the accumulated links, and Detective Sen assigns the missing ₹48,000 to you.",
  },
};

const examLeakEpilogues: Record<Role, Record<Verdict, string>> = {
  innocent: {
    released: "Detective Sen closes the file. The public record shows authorized-looking access and an unverified message, but it never proves that you distributed an exam paper.",
    under_suspicion: "You leave while Detective Sen keeps the leak file open. The access and print timing are uncomfortable, but the public allegations do not identify a distributor.",
    caught: "In this fictional game, your explanation failed to convince Detective Sen. You were innocent, but contradictions or an admission produced the worst interview ending. The suspicion score measures your story, not actual guilt.",
  },
  guilty: {
    released: "Detective Sen closes the file. The unverified recipient message and account limitations leave enough room for your cover story to stand.",
    under_suspicion: "You leave under suspicion. The print-room sequence and recipient message form a lead, but the public record still stops short of proving distribution.",
    caught: "The interview ends with the unauthorized distribution assigned to you. The access, printing, and recipient account now align against your explanation.",
  },
};

const missingTrophyEpilogues: Record<Role, Record<Verdict, string>> = {
  innocent: {
    released: "Detective Sen closes the file. The public clues show access and shared equipment, but they never prove that you removed the trophy.",
    under_suspicion: "You leave while Detective Sen keeps the display file open. The access and movement timing are uncomfortable, but shared equipment leaves the theft unproved.",
    caught: "In this fictional game, your explanation failed to convince Detective Sen. You were innocent, but contradictions or an admission produced the worst interview ending. The suspicion score measures your story, not actual guilt.",
  },
  guilty: {
    released: "Detective Sen closes the file. The shared cart and generic glove leave enough uncertainty for your removal of the trophy to stay unproved.",
    under_suspicion: "You leave under suspicion. The display access and crate movement make a lead, but the public record still stops short of proving removal.",
    caught: "The interview ends with the unauthorized removal assigned to you. The display access, case, and crate movement now align against your explanation.",
  },
};

export const CASES: Record<CaseId, CaseDefinition> = {
  "fest-fund": {
    id: "fest-fund",
    title: "The Missing Fest Fund",
    summary: "The ₹48,000 fest fund disappeared during a 20:40–21:00 finance-office access window.",
    accusation: "You stole ₹48,000 from the fest fund during the finance-office access window.",
    confessionTarget: "Taking the ₹48,000 from the fest fund.",
    evidence: festFundEvidence,
    replies: festFundReplies,
    epilogues: festFundEpilogues,
  },
  "exam-leak": {
    id: "exam-leak",
    title: "The Exam Paper Leak",
    summary: "An exam paper was allegedly distributed before the exam after access and printing activity linked to you.",
    accusation: "You distributed an unauthorized exam paper before the exam.",
    confessionTarget: "Distributing an unauthorized exam paper to students before the exam.",
    evidence: examLeakEvidence,
    replies: examLeakReplies,
    epilogues: examLeakEpilogues,
  },
  "missing-trophy": {
    id: "missing-trophy",
    title: "The Missing Trophy",
    summary: "A trophy disappeared from the event display after access and equipment movement linked to you.",
    accusation: "You removed the trophy from the display without authorization.",
    confessionTarget: "Removing the trophy from the display without authorization.",
    evidence: missingTrophyEvidence,
    replies: missingTrophyReplies,
    epilogues: missingTrophyEpilogues,
  },
};

// Legacy exports remain aliases for the original default case.
export const CASE_TITLE = CASES["fest-fund"].title;
export const EVIDENCE = CASES["fest-fund"].evidence;
export const DETECTIVE_REPLIES = CASES["fest-fund"].replies;
export const EPILOGUES = CASES["fest-fund"].epilogues;
