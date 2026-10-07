import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { writable, type Writable } from 'svelte/store';

export interface UserProfile {
    uid: string;
    firstName: string;
    lastName: string;
    email: string;
}

export const userProfile: Writable<UserProfile | null> = writable(null);

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const userDoc = await getDoc(doc(db, 'rapidtools_users', uid));
        if (userDoc.exists()) {
            const data = userDoc.data() as UserProfile;
            userProfile.set(data);
            return data;
        }
        userProfile.set(null);
        return null;
    } catch (error) {
        console.error('Error fetching user profile:', error);
        userProfile.set(null);
        return null;
    }
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
    try {
        await setDoc(doc(db, 'rapidtools_users', profile.uid), profile);
        userProfile.set(profile);
    } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
    }
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
        await setDoc(doc(db, 'rapidtools_users', uid), updates, { merge: true });
        const updatedProfile = await fetchUserProfile(uid);
        if (updatedProfile) {
            userProfile.set(updatedProfile);
        }
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

export async function fetchAllUserProfiles(): Promise<UserProfile[]> {
    try {
        const querySnapshot = await getDocs(collection(db, 'rapidtools_users'));
        const profiles: UserProfile[] = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as Partial<UserProfile>;
            profiles.push({
                uid: data.uid || docSnap.id,
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                email: data.email || ''
            });
        });
        return profiles.sort((a, b) => {
            const nameA = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
            const nameB = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });
    } catch (error) {
        console.error('Error fetching all user profiles:', error);
        throw error;
    }
} 