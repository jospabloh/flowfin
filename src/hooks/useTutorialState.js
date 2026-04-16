const persistState = async (newState) => {
    if (isWriting) {
        console.warn('Attempted to write while already in progress. Skipping write.');
        return;
    }
    if (pendingPayloads.includes(newState)) {
        console.warn('Duplicate payload detected. Skipping write.');
        return;
    }
    pendingPayloads.push(newState);

    isWriting = true;
    try {
        // Simulate async write
        await saveStateToDatabase(newState);
        console.log('State saved successfully.');
        pendingPayloads = pendingPayloads.filter(payload => payload !== newState);
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.warn('Received 429 status. Implementing backoff.');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Backoff for 2 seconds
        } else {
            console.error('An error occurred:', error);
        }
    } finally {
        isWriting = false;
    }
};

let isWriting = false;
let pendingPayloads = [];