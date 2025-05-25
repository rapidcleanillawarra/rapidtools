import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const GET: RequestHandler = async () => {
  try {
    const brandsSnapshot = await getDocs(collection(db, 'brands'));
    const brands = brandsSnapshot.docs.map(doc => {
      const data = doc.data();
      const name = data.name;
      return {
        id: doc.id,
        ...data,
        value: name,
        label: name
      };
    });
    
    return json(brands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return new Response('Error fetching brands', { status: 500 });
  }
}; 