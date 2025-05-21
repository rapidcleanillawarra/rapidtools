import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const GET: RequestHandler = async () => {
  try {
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const categories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      value: doc.data().name,
      label: doc.data().name
    }));
    
    return json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response('Error fetching categories', { status: 500 });
  }
}; 