import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import connectDB from "../config/db.js";
import Faq from "../models/Faq.js";

await connectDB();
const faqData = [
    {
        question: "What is the AI Scheduling Assistant?",
        answer:
            "The AI Scheduling Assistant is a smart tool that helps you manage and automate your meetings, appointments, and reminders efficiently.",
    },
    {
        question: "Is it compatible with my calendar?",
        answer:
            "Yes, it integrates seamlessly with Google Calendar, Outlook, and Apple Calendar so your schedules are always in sync.",
    },
    {
        question: "Can I customize notifications?",
        answer:
            "Absolutely! You can set up personalized reminders, adjust notification tones, and control how you receive updates.",
    },
    {
        question: "Is there a free plan?",
        answer:
            "Yes, we offer a free plan with essential features. You can upgrade anytime for more advanced capabilities.",
    },
    {
        question: "What is the AI Scheduling Assistant?",
        answer:
            "The AI Scheduling Assistant is a smart tool that helps you manage and automate your meetings, appointments, and reminders efficiently.",
    },
    {
        question: "Can I customize notifications?",
        answer:
            "Absolutely! You can set up personalized reminders, adjust notification tones, and control how you receive updates.",
    },
    {
        question: "Is there a free plan?",
        answer:
            "Yes, we offer a free plan with essential features. You can upgrade anytime for more advanced capabilities.",
    },
    {
        question: "Is it compatible with my calendar?",
        answer:
            "Yes, it integrates seamlessly with Google Calendar, Outlook, and Apple Calendar so your schedules are always in sync.",
    },
];

await Faq.insertMany(faqData);
console.log("FAQ data inserted!");
process.exit();

