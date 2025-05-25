import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const GET: RequestHandler = async () => {
  try {
    const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
    const suppliers = suppliersSnapshot.docs.map(doc => {
      const data = doc.data();
      const name = data.name;
      return {
        id: doc.id,
        ...data,
        value: name,
        label: name
      };
    });
    
    return json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return new Response('Error fetching suppliers', { status: 500 });
  }
}; 