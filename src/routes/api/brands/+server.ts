import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const GET: RequestHandler = async () => {
  try {
    const brandsSnapshot = await getDocs(collection(db, 'brands'));
    const brands = brandsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      value: doc.data().name,
      label: doc.data().name
    }));
    
    return json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return new Response('Error fetching brands', { status: 500 });
  }
}; 