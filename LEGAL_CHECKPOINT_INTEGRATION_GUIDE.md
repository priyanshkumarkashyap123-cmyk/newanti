# How to Integrate Design and Signup Checkpoints

## 1. Design Checkpoint Integration

### Location
Design is typically triggered from one of these components:
- `apps/web/src/components/DesignCodesDialog.tsx` (if it exists)
- `apps/web/src/components/IS456DesignPanel.tsx`
- `apps/web/src/components/SteelDesignPanel.tsx`
- Or wherever the design calculation is initiated

### Implementation Steps

#### Step 1: Find the Design Trigger
Search for the main design execution function:
```typescript
// In the design component
const handleRunDesign = () => {
    // Current code that runs design
};
```

#### Step 2: Add Required Imports
```typescript
import { CheckpointLegalModal } from './CheckpointLegalModal';
import consentService from '../services/ConsentService';
```

#### Step 3: Add State Variables
```typescript
const [showDesignConsentModal, setShowDesignConsentModal] = useState(false);
```

#### Step 4: Split the Design Execution
```typescript
// Original function becomes the check
const handleRunDesign = async () => {
    const userId = getCurrentUserId(); // Get from auth context
    const hasConsent = consentService.hasUserAccepted(userId, 'design');
    
    if (!hasConsent) {
        setShowDesignConsentModal(true);
        return; // User will click accept to trigger onAccept
    }
    
    // User already accepted, proceed with design
    executeDesign();
};

// New function with actual design logic
const executeDesign = async () => {
    // Move your current design calculation code here
    // This runs AFTER consent is verified
    try {
        // Your design logic
        const designResults = await performDesignCalculation();
        // Display results
    } catch (error) {
        // Handle errors
    }
};
```

#### Step 5: Add Modal to Component JSX
```typescript
return (
    <>
        {/* Your existing component UI */}
        <div>
            {/* Design form and inputs */}
        </div>
        
        {/* Add this legal checkpoint modal */}
        <CheckpointLegalModal
            open={showDesignConsentModal}
            onAccept={() => {
                setShowDesignConsentModal(false);
                executeDesign(); // Run design after consent
            }}
            onDecline={() => {
                setShowDesignConsentModal(false);
                // User declined - don't run design
            }}
            checkpointType="design"
            userId={getCurrentUserId()}
            canClose={true} // Design is not mandatory (user can skip)
        />
    </>
);
```

### Example: IS456DesignPanel Integration
```typescript
import { useState } from 'react';
import { CheckpointLegalModal } from '../CheckpointLegalModal';
import consentService from '../../services/ConsentService';

export const IS456DesignPanel = () => {
    const [showDesignConsentModal, setShowDesignConsentModal] = useState(false);
    
    const handleRunDesign = async () => {
        const userId = getCurrentUserId();
        const hasConsent = consentService.hasUserAccepted(userId, 'design');
        
        if (!hasConsent) {
            setShowDesignConsentModal(true);
            return;
        }
        
        executeDesign();
    };
    
    const executeDesign = async () => {
        // Your design calculation
    };
    
    return (
        <>
            {/* Existing design form */}
            <div className="design-panel">
                {/* Design inputs */}
                <button onClick={handleRunDesign}>Run Design</button>
            </div>
            
            {/* Legal checkpoint */}
            <CheckpointLegalModal
                open={showDesignConsentModal}
                onAccept={() => {
                    setShowDesignConsentModal(false);
                    executeDesign();
                }}
                onDecline={() => setShowDesignConsentModal(false)}
                checkpointType="design"
                userId={getCurrentUserId()}
                canClose={true}
            />
        </>
    );
};
```

## 2. Signup Checkpoint Integration

### Location
Signup flow is typically handled through:
- `Clerk` authentication (if using Clerk)
- Custom auth component
- Login/Register modal

### Option A: Clerk Signup Integration

If using Clerk authentication, integrate the checkpoint into the signup flow:

#### Step 1: Find Clerk Configuration
Locate where Clerk is configured:
```typescript
// Usually in App.tsx or root component
import { ClerkProvider } from '@clerk/clerk-react';

<ClerkProvider publishableKey={...}>
    {/* App */}
</ClerkProvider>
```

#### Step 2: Create Signup Wrapper Component
```typescript
import { useAuth } from '@clerk/clerk-react';
import { CheckpointLegalModal } from './CheckpointLegalModal';
import consentService from '../services/ConsentService';

export const SignupCheckpointWrapper = ({ children }) => {
    const { userId, isSignedIn } = useAuth();
    const [showSignupConsent, setShowSignupConsent] = useState(false);
    const [pendingSignupComplete, setPendingSignupComplete] = useState(false);
    
    // When user signs up, check for consent
    useEffect(() => {
        if (isSignedIn && userId) {
            const hasConsent = consentService.hasUserAccepted(userId, 'signup');
            if (!hasConsent && !pendingSignupComplete) {
                setShowSignupConsent(true);
                setPendingSignupComplete(true);
            }
        }
    }, [isSignedIn, userId]);
    
    return (
        <>
            {children}
            
            <CheckpointLegalModal
                open={showSignupConsent}
                onAccept={() => {
                    setShowSignupConsent(false);
                    // User accepted - they can now use the app
                }}
                onDecline={() => {
                    setShowSignupConsent(false);
                    // Optionally sign out user if they decline
                    // signOut();
                }}
                checkpointType="signup"
                userId={userId || undefined}
                canClose={false} // Signup consent is mandatory
            />
        </>
    );
};

// Use in App.tsx:
<SignupCheckpointWrapper>
    <YourAppContent />
</SignupCheckpointWrapper>
```

#### Step 3: Update Clerk User Metadata (Optional)
After consent acceptance, optionally push to Clerk:
```typescript
const { user } = useAuth();

const recordClerkConsent = async () => {
    if (user) {
        await user.update({
            unsafeMetadata: {
                ...user.unsafeMetadata,
                accepted_legal_terms: new Date().toISOString()
            }
        });
    }
};

// Call in onAccept callback
onAccept={() => {
    recordClerkConsent();
    setShowSignupConsent(false);
}}
```

### Option B: Custom Auth Integration

If using custom authentication:

#### Step 1: Create Custom Signup Handler
```typescript
import { CheckpointLegalModal } from './CheckpointLegalModal';
import consentService from '../services/ConsentService';

export const CustomSignupFlow = () => {
    const [showSignupConsent, setShowSignupConsent] = useState(false);
    const [pendingSignup, setPendingSignup] = useState<{email: string, password: string} | null>(null);
    
    const handleSignupSubmit = async (email: string, password: string) => {
        // Instead of immediately signing up, show consent first
        setPendingSignup({ email, password });
        setShowSignupConsent(true);
    };
    
    const completeSignup = async () => {
        if (!pendingSignup) return;
        
        try {
            // Create account
            const user = await createUser(pendingSignup.email, pendingSignup.password);
            
            // Record consent
            consentService.recordConsent(user.id, 'signup');
            
            // Sign them in
            await signIn(user.id);
            
            // Navigate to dashboard
            navigate('/dashboard');
        } catch (error) {
            // Handle signup error
        }
    };
    
    return (
        <>
            {/* Signup form */}
            <SignupForm onSubmit={handleSignupSubmit} />
            
            {/* Legal checkpoint */}
            <CheckpointLegalModal
                open={showSignupConsent}
                onAccept={() => {
                    setShowSignupConsent(false);
                    completeSignup();
                }}
                onDecline={() => {
                    setShowSignupConsent(false);
                    setPendingSignup(null);
                    // User declined - don't sign them up
                }}
                checkpointType="signup"
                userId={pendingSignup?.email} // Can use email as ID during signup
                canClose={false} // Signup consent is mandatory
            />
        </>
    );
};
```

## 3. Helper Function: Get Current User ID

Create a utility to consistently get the user ID from wherever it's stored:

```typescript
// apps/web/src/utils/auth.ts

import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAppStore } from '../store/app'; // Or wherever your auth state is

export const getCurrentUserId = (): string => {
    // Try Clerk first
    const { userId } = useClerkAuth();
    if (userId) return userId;
    
    // Fall back to app store
    const userId = useAppStore((state) => state.userId);
    if (userId) return userId;
    
    // Fall back to localStorage
    const stored = localStorage.getItem('user_id');
    if (stored) return stored;
    
    // Return anonymous ID if not logged in
    return 'anonymous';
};

// Usage:
const userId = getCurrentUserId();
const hasConsent = consentService.hasUserAccepted(userId, 'design');
```

## 4. Testing the Integrations

### Design Checkpoint Test
```
1. Open design panel
2. Enter design parameters
3. Click "Run Design"
4. Modal should appear (first time only)
5. Accept and design should run
6. Run design again - modal should NOT appear (cached consent)
7. Clear localStorage["beamlab_user_consents"] in DevTools
8. Run design again - modal should reappear
```

### Signup Checkpoint Test
```
1. Go to signup page
2. Enter email and password
3. Click "Sign Up"
4. Legal consent modal should appear (before account creation)
5. Accept and account should be created
6. Log back in - modal should NOT appear (consent cached)
7. New user signup - modal should appear again (new user)
```

## 5. Troubleshooting

### Modal Not Appearing
```
// Check if user ID is correct
console.log('User ID:', getCurrentUserId());

// Check if consent was already recorded
const consents = JSON.parse(localStorage.getItem('beamlab_user_consents') || '{}');
console.log('Stored consents:', consents);

// Check if function is being called
console.log('Has consent:', consentService.hasUserAccepted(userId, 'design'));
```

### Consent Not Persisting
```
// Check localStorage is working
localStorage.setItem('test', 'value');
console.log(localStorage.getItem('test')); // Should print 'value'

// Check consent service is saving
consentService.recordConsent('test-user', 'design');
const consents = JSON.parse(localStorage.getItem('beamlab_user_consents') || '{}');
console.log(consents['test-user']); // Should show 'design' entry
```

### Action Not Running After Consent
```
// Make sure onAccept callback is calling executeDesign()
<CheckpointLegalModal
    onAccept={() => {
        console.log('Consent accepted!'); // Add debug logging
        setShowModal(false);
        executeDesign(); // Make sure this is called
    }}
    // ... other props
/>

// Make sure executeDesign() exists and runs
const executeDesign = async () => {
    console.log('Design starting...'); // Add debug logging
    // ... design logic
};
```

## 6. Checklist

- [ ] Design checkpoint implemented in design component
- [ ] Design checkpoint tested (modal appears, consent persists)
- [ ] Signup checkpoint implemented (Clerk or custom)
- [ ] Signup checkpoint tested (appears for new users, cached)
- [ ] User ID retrieval working across all components
- [ ] localStorage consent data verified
- [ ] All 5 checkpoints functional (signup, analysis, design, pdf_export, initial_landing)
- [ ] Consent persistence tested across browser sessions
- [ ] Mobile testing completed
- [ ] Deploy to production

---

**Once both integrations are complete, you'll have a complete legal consent flow across your entire application workflow.**
