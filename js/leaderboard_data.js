

    // ساخت داده تستی
    const users = [];
    for (let i = 1; i <= 15; i++) {
        users.push({
            rank: ` ${i} #`,
            username: `username ${i}`,
            score: Math.floor(Math.random() * 1000) + 100 // امتیاز رندوم
        });
    }

    // پر کردن بخش سه نفر اول
    function fillTopThree() {
        const first = document.querySelector(".one");
        const second = document.querySelector(".two");
        const third = document.querySelector(".three");

        // نفر اول
        first.innerHTML = `
            <div class="leader_profile top1"><img src="img/icons/profile.svg" alt="profile"></div>
            <div class="count_num_leder">${users[0].rank}</div>
            <div class="leader_user_name">${users[0].username}</div>
        `;

        // نفر دوم
        second.innerHTML = `
            <div class="leader_profile top2"><img src="img/icons/profile.svg" alt="profile"></div>
            <div class="count_num_leder">${users[1].rank}</div>
            <div class="leader_user_name">${users[1].username}</div>
        `;

        // نفر سوم
        third.innerHTML = `
            <div class="leader_profile top3"><img src="img/icons/profile.svg" alt="profile"></div>
            <div class="count_num_leder">${users[2].rank}</div>
            <div class="leader_user_name">${users[2].username}</div>
        `;
    }

    // پر کردن لیست بقیه کاربران
    function fillLeadersList() {
        const listContainer = document.querySelector(".leaders_list");
        listContainer.innerHTML = ""; // خالی کردن قبل از پر کردن

        users.slice(3).forEach(user => {
            const item = document.createElement("div");
            item.classList.add("leaders_list_item", "normal_user"); // کلاس عمومی
            item.innerHTML = `
                <div class="count_number">${user.rank}</div>
                <div class="item_username">${user.username}</div>
                <div class="item_user_score">${user.score}</div>
            `;
            listContainer.appendChild(item);
        });
    }

    // اجرای توابع
    fillTopThree();
    fillLeadersList();
