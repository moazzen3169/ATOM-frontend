const overlay = document.querySelector(".overlay");
const leveL2Modal = document.querySelector(".level_2_modal");
const leveL3Modal = document.querySelector(".level_3_modal");
const level2btn = document.querySelector("#level-2-btn");
const level3btn = document.querySelector("#level-3-btn");
const nemuneh =document.querySelector(".nemuneh");
const nemunehModal =document.querySelector(".nemuneh_modal");

// overlay.classList.add("hidden");
// leveL2Modal.classList.add("hidden");
// leveL3Modal.classList.add("hidden");
// nemunehModal.classList.add("hidden");

level2btn.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    leveL2Modal.classList.remove("hidden");

    // Initialize file handlers for level 2 modal after it's shown
    initializeLevel2FileHandlers();
});
level3btn.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    leveL3Modal.classList.remove("hidden");

    // Initialize file handlers for level 3 modal after it's shown
    initializeLevel3FileHandlers();
});

overlay.addEventListener("click" , function(){
    leveL3Modal.classList.add("hidden");
    leveL2Modal.classList.add("hidden");
    overlay.classList.add("hidden");
    nemunehModal.classList.add("hidden");

})

nemuneh.addEventListener("click" , function(){
    overlay.classList.remove("hidden");
    nemunehModal.classList.remove("hidden");

})

// Function to format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Function to check if file is a valid video format
function isValidVideoFile(fileName) {
    const validExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp', '.mpg', '.mpeg'];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return validExtensions.includes(fileExtension);
}

// Function to validate and display file info
function handleFileSelection(input, infoDiv, maxSizeMB, isVideoInput = false) {
    const file = input.files[0];
    if (file) {
        // Check file extension for video inputs
        if (isVideoInput && !isValidVideoFile(file.name)) {
            infoDiv.innerHTML = `<span style="color: red;">فرمت فایل نامعتبر است. فقط فایل‌های ویدیویی مجاز هستند.</span>`;
            input.value = ''; // Clear the input
            // Also update the label text to show the default prompt again
            const label = input.previousElementSibling;
            if (label && label.tagName.toLowerCase() === 'label') {
                label.querySelector('p').textContent = 'ویدیوی سلفی خود را انتخاب کنید';
            }
            return;
        }

        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxSizeMB) {
            infoDiv.innerHTML = `<span style="color: red;">حجم فایل بیش از حد مجاز است (${maxSizeMB}MB)</span>`;
            input.value = ''; // Clear the input
            // Also update the label text to show the default prompt again
            const label = input.previousElementSibling;
            if (label && label.tagName.toLowerCase() === 'label') {
                const defaultText = isVideoInput ? 'ویدیوی سلفی خود را انتخاب کنید' : 'فایل را انتخاب کنید';
                label.querySelector('p').textContent = defaultText;
            }
        } else {
            infoDiv.innerHTML = `حجم فایل: ${formatFileSize(file.size)}`;
            // Update the label text to show the file name
            const label = input.previousElementSibling;
            if (label && label.tagName.toLowerCase() === 'label') {
                label.querySelector('p').textContent = file.name;
            }
        }
    }
}

// Initialize file handlers for level 2 modal
function initializeLevel2FileHandlers() {
    const level2SelfyInput = document.querySelector(".level_2_modal #selfy_picturse");
    const level2IdCardInput = document.querySelector(".level_2_modal #id_card");
    const level2SelfyInfo = document.querySelector(".level_2_modal #selfy_info");
    const level2IdCardInfo = document.querySelector(".level_2_modal #id_card_info");

    if (level2SelfyInput) {
        level2SelfyInput.addEventListener('change', function() {
            handleFileSelection(this, level2SelfyInfo, 5);
        });
    }

    if (level2IdCardInput) {
        level2IdCardInput.addEventListener('change', function() {
            handleFileSelection(this, level2IdCardInfo, 5);
        });
    }
}

// Initialize file handlers for level 3 modal
function initializeLevel3FileHandlers() {
    const level3SelfyInput = document.querySelector(".level_3_modal #selfy_picturse");
    const level3SelfyInfo = document.querySelector(".level_3_modal #selfy_info");

    if (level3SelfyInput) {
        level3SelfyInput.accept = "video/*"; // Change to accept only video files
        level3SelfyInput.addEventListener('change', function() {
            handleFileSelection(this, level3SelfyInfo, 10, true); // true for video input validation
        });
    }
}

