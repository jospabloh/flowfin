import { useState, useEffect, useCallback } from 'react';

const useTutorialState = () => {
    const [tutorialState, setTutorialState] = useState(null);
    const [shouldAutoOpen, setShouldAutoOpen] = useState(false);
    const pendingState = useRef(null);
    const inFlight = useRef(false);

    const loadTutorialState = async () => {
        // Load tutorial state from FamilyMembership
        const state = await loadFromFamilyMembership();
        setTutorialState(state);
    };

    useEffect(() => {
        loadTutorialState();
    }, []);

    const persistState = useCallback(async (newState) => {
        if (inFlight.current) {
            pendingState.current = newState;
            return;
        }

        if (JSON.stringify(tutorialState) === JSON.stringify(newState)) {
            return;
        }

        inFlight.current = true;
        try {
            await saveToFamilyMembership(newState);
            setTutorialState(newState);
        } catch (error) {
            if (error.status === 429) {
                // Handle 429 with bounded exponential backoff
                handle429Backoff(persistState, newState);
            }
        } finally {
            inFlight.current = false;
            if (pendingState.current) {
                persistState(pendingState.current);
                pendingState.current = null;
            }
        }
    }, [tutorialState]);

    const startOrResume = () => {...};
    const restartFromBeginning = () => {...};
    const setCurrentStep = (step) => persistState({...tutorialState, currentStep: step});
    const markPostponed = () => persistState({...tutorialState, status: 'postponed'});
    const markSkipped = () => persistState({...tutorialState, status: 'skipped'});
    const markCompleted = () => persistState({...tutorialState, status: 'completed'});

    return { tutorialState, shouldAutoOpen, startOrResume, restartFromBeginning, setCurrentStep, markPostponed, markSkipped, markCompleted };
};

export default useTutorialState;
