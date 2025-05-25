import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export const GET: RequestHandler = async () => {
  try {
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const categories = categoriesSnapshot.docs.map(doc => {
      const data = doc.data();
      const name = data.name;
      return {
        id: doc.id,
        ...data,
        value: name,
        label: name
      };
    });
    
    return json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response('Error fetching categories', { status: 500 });
  }
}; 