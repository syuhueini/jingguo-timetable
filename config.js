/**
 * 桃園市立經國國民中學｜115學年度第1學期課表設定
 */
const CONFIG = {
    SEMESTERS: {
        '115學年度 第一學期': './timetable_1151.csv',
    },

    // 靜態網站的登入資訊僅適合「簡易門檻」，不具真正的安全性；可直接使用「訪客登入」。
    USERNAME: 'teacher',
    PASSWORD: 'teacher1151',

    SCHOOL_NAME: '桃園市立經國國民中學',
    SCHOOL_SUBTITLE: '國中部課表查詢系統',

    PERIOD_TIMES: [
        { start: '——', end: '——', label: '早自習' },
        { start: '08:25', end: '09:10' },
        { start: '09:20', end: '10:05' },
        { start: '10:15', end: '11:00' },
        { start: '11:10', end: '11:55' },
        { start: '13:05', end: '13:50' },
        { start: '14:00', end: '14:45' },
        { start: '15:00', end: '15:45' },
        { start: '15:55', end: '16:40' },
        { start: '——', end: '——' },
    ],
};
