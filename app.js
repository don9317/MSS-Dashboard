document.addEventListener("DOMContentLoaded", function () {

    const today = new Date();
    const formatted = today.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    document.getElementById("data-date").textContent = "Data Date: " + formatted;

    window.markUploadTime = function () {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        document.getElementById("last-upload").textContent = "Last Upload: " + time;
    };

    window.updateDataDateDisplay = function(dateObj) {
        const el = document.getElementById("data-date");
        if (!el) return;
        if (!dateObj) return;
        const d = dateObj.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
        el.textContent = "Data Date: " + d;
    };
});
