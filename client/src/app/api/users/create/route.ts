import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

// This function will handle creating both Admins (teachers) and Students
export async function POST(req: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ success: false, error: 'Server Error: Firebase Admin not initialized. Check .env.local and restart server.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const {
      email,
      password,
      authMethod,
      name,
      role, // 'admin' or 'student'
      permissions, // for admins
      nationalId, // for admins
      phone, // for admins
      assignments, // for admins
      studentAssignment // for students
    } = body;

    // --- Basic Validation ---
    if (!email || !name || !role || !authMethod) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // --- Check if user already exists ---
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ success: false, error: 'User with this email already exists.' }, { status: 409 });
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        console.error("Error checking for user:", error);
        throw new Error("An unexpected error occurred while checking for the user.");
      }
      // If user is not found, we can proceed.
    }

    // --- Handle User Creation based on Auth Method ---
    if (authMethod === 'password') {
      if (!password) {
        return NextResponse.json({ success: false, error: 'Password is required.' }, { status: 400 });
      }

      // 1. Create user in Firebase Authentication
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      });
      const uid = userRecord.uid;

      // 2. Set custom claims for role-based access control
      await adminAuth.setCustomUserClaims(uid, { role });

      // 3. Prepare user data for Firestore
      const userData: any = {
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
      };

      if (role === 'admin') {
        userData.permissions = permissions || {};
        userData.assignments = assignments || [];
        userData.nationalId = nationalId || '';
        userData.phone = phone || '';
      } else if (role === 'student') {
        userData.gradeId = studentAssignment?.gradeId || '';
        userData.specializationId = studentAssignment?.specializationId || '';
      }

      // 4. Save the user's profile data in Firestore
      await adminDb.collection('users').doc(uid).set(userData);

      return NextResponse.json({ success: true, message: `User ${name} created successfully with password.` });

    } else if (authMethod === 'google') {
      // For Google sign-in, we "pre-provision" their role in Firestore.
      // The client-side logic will handle the rest on first login.
      const userRoleData: any = {
        name,
        email,
        role,
        provisionedBy: 'admin',
        createdAt: new Date().toISOString(),
        ...(role === 'admin' && { permissions, assignments, nationalId, phone }),
        ...(role === 'student' && { gradeId: studentAssignment?.gradeId, specializationId: studentAssignment?.specializationId }),
      };

      await adminDb.collection('user_roles').doc(email).set(userRoleData);

      return NextResponse.json({ success: true, message: `User ${name} is provisioned for Google Sign-In.` });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid authentication method.' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error in user creation endpoint:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to process request.' }, { status: 500 });
  }
}