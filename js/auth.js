const AUTH_KEY = '8puzzle_user';

const Auth = {
    login: function(username) {
        if (!username || username.trim() === '') return false;
        localStorage.setItem(AUTH_KEY, username.trim());
        window.location.href = 'dashboard.html';
        return true;
    },

    logout: function() {
        localStorage.removeItem(AUTH_KEY);
        window.location.href = 'login.html';
    },

    getUser: function() {
        return localStorage.getItem(AUTH_KEY);
    },

    requireAuth: function() {
        if (!this.getUser()) {
            window.location.href = 'login.html';
        }
    },

    redirectIfLoggedIn: function() {
        if (this.getUser()) {
            window.location.href = 'dashboard.html';
        }
    }
};
