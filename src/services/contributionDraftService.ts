import { doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { MissingProductDraft } from '../types/contribution';

export const saveMissingProductDraft = async (
  draft: MissingProductDraft
): Promise<void> => {
  await setDoc(
    doc(db, 'missingProductDrafts', draft.barcode),
    {
      ...draft,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  );
};