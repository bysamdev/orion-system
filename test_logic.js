// Simulating the React logic
let notes = '1234567890'.repeat(9) + '12345'; // 95 chars
let resolveDialogOpen = true;

const handleConfirm = () => {
    console.log("handleConfirm called. notes:", notes, "length:", notes.length);
    if (!notes.trim()) return;
    onConfirm(notes.trim(), true);
};

const onConfirm = (n, s) => {
    handleResolveConfirm(n, s);
};

const handleResolveConfirm = async (n, _s) => {
    console.log("handleResolveConfirm called. n:", n, "length:", n.length);
    if (!n.trim()) {
        console.log("TOAST: Preencha a solução.");
        return;
    }
    console.log("SUCCESS");
};

handleConfirm();
