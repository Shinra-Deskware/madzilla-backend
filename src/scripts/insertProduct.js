import connectDB from "../config/db.js";
import Product from "../models/Product.js";

await connectDB();

const product = [
    {
        key: "product1",
        title: "Godzilla Classic",
        images: ["product1.png", "product1.png", "product1.png"],
        video: "/assets/product-video.mp4",
        stock: true,
        // 📝 Structured description (uses only existing images)
        productDescription: [
            {
                image: "product1.png", text: "This Godzilla collectible is crafted with premium - grade PLA material, designed to deliver a smooth, durable, and finely detailed finish.Every scale, spike, and curve is sculpted to reflect the iconic look of the legendary monster.The strong base and lightweight build make it easy to place on shelves, desks, or display cases without compromising stability.This isn’t just a toy — it’s a high- quality centerpiece built to impress collectors, fans, and design enthusiasts alike."
            },
            { image: "product1.png", text: "Powering the collectible is effortless with its reliable USB Type-C connection, supporting a standard 5V USB source. Once connected, the figure transforms with stunning multicolor spine lighting, creating a powerful ambient glow. Control is fully wireless through a dedicated companion app compatible with both iOS and Android devices. With seamless Bluetooth pairing, users can easily customize lighting effects, brightness, and modes to match their space and mood." },
            { image: "product1.png", text: "The toy is built with a water-resistant exterior, ensuring durability even in everyday environments. It’s recommended for ages 6 and above, as the figure contains small, sharp details designed to preserve the authentic look of Godzilla. When powered safely and handled with care, it delivers a premium, immersive display experience — a perfect fusion of artistry, technology, and nostalgia." }
        ],
        // 🛡️ Warranty
        warrantyDetails:
            "We stand behind the quality of our product. This item is covered by a one-year limited warranty against manufacturing defects from the date of purchase. If your product exhibits a manufacturing fault during the warranty period, we will repair or replace it at our discretion — free of charge — after a quick inspection and proof of purchase. This warranty does not cover damage caused by misuse, accidental damage, improper power sources, unauthorized repairs, or normal wear and tear. For faster service, please contact our support team with your order number and photos of the issue; we’ll guide you through the replacement or repair process and clarify any shipping steps.",

        // ⚠️ Safety
        warnings: [
            "Contains small and sharp parts. Not suitable for children under 6 years. Adult supervision required.",
            "Use only a 5V USB Type-C power source. Do not use higher-voltage adapters or modified power supplies.",
            "Do not open, modify, or attempt to repair the product. Unauthorized disassembly voids warranty.",
            "Avoid immersion; not guaranteed waterproof for prolonged submersion.",
            "Stop using immediately if cable, connector, or housing is damaged.",
            "Charge only with certified adapters/cables. Supervise charging and keep away from flammable surfaces.",
            "Disconnect power before cleaning. Use a dry or lightly damp cloth only.",
            "Dispose of electronic components per local e-waste regulations.",
            "If you notice unusual heat, smoke, or smells, disconnect immediately and contact support."
        ],
        legalDisclaimer:
            "This product is intended for hobby and decorative use only. The seller is not liable for injury, damage, or misuse of the product. By purchasing, you acknowledge you’ve read and agreed to the safety instructions.",

        // 📦 Box contents
        whatsInTheBox: [
            "1 × Godzilla Classic Unit",
            "1 × USB Type-C Cable",
            "1 × Quick Start Guide",
            "1 × Warranty Card"
        ],

        // ⚡ Specs & App
        powerSpecs: {
            voltage: "5V DC",
            current: "2A",
            connector: "USB Type-C",
            powerConsumption: "10W (max)"
        },
        appInfo: {
            name: "Godzilla Control App",
            ios: "iOS 13+",
            android: "Android 8+",
            pairing: "Enable Bluetooth, open the app, and tap 'Connect' to pair."
        },

        // 💸 Policy, Age, Care, Labels
        returnPolicy:
            "7-day replacement policy applicable only on manufacturing defects. No refunds on physical or power damage. Buyer is responsible for return shipping unless the product is faulty on arrival.",
        ageRestriction: "⚠️ Not suitable for children under 6 years of age. This is a collectible, not a toy.",
        careInstructions: [
            "Wipe gently with a dry cloth.",
            "Store indoors in a cool, dry place.",
            "Avoid direct sunlight for long periods.",
            "Do not immerse in water."
        ],
        certificationInfo:
            "This is a DIY collectible product designed for decorative use. Not BIS or CE certified. Complies with basic USB 5V handling standards.",

        // ⭐ Reviews (using existing images)
        reviews: [
            { user: "Ravi", rating: 5, comment: "Amazing detail and quality. Worth the price!", images: ["product1.png"] },
            { user: "Aditi", rating: 4, comment: "Loved the finish and packaging was great.", images: ["product1.png", "product1.png"] },
            { user: "Karan", rating: 5, comment: "A must-have for any Godzilla fan!", images: [] }
        ],

        // 🔹 Existing bullets & services
        features: [
            { icon: "Category", text: "Made with high-quality PLA for a durable and smooth finish." },
            { icon: "Power", text: "Powered using a universal Type-C connector for easy plug-and-play." },
            { icon: "Bluetooth", text: "Seamlessly controlled via Bluetooth for a wireless experience." },
            { icon: "PhoneIphone", text: "Fully compatible with both iOS and Android devices." },
            { icon: "ChildCare", text: "Suitable for ages 6+ — contains small, sharp parts." },
            { icon: "Palette", text: "Features dynamic colors that bring the design to life." },
            { icon: "Pets", text: "Inspired by the legendary Godzilla." },
            { icon: "LightMode", text: "Built-in ambient lighting enhances display aesthetics." },
            { icon: "MonitorWeight", text: "Lightweight design, easy to place and reposition anywhere." }
        ],
        services: [
            "UPI / Debit / Credit Cards Accepted",
            "2 Year Warranty",
            "7 Days Replacement"
        ],

        // 💰 Pricing
        price: "₹2,519",
        originalPrice: "₹3,499",
        discount: "28% OFF",
        rating: "4.7",
        totalReviews: "200"
    },

    {
        key: "product2",
        title: "Godzilla Glow Edition",
        images: ["product2.png", "product2.png", "product2.png"],
        video: "/assets/product-video.mp4",
        stock: true,

        productDescription: [
            {
                image: "product2.png", text: "This Godzilla collectible is crafted with premium - grade PLA material, designed to deliver a smooth, durable, and finely detailed finish.Every scale, spike, and curve is sculpted to reflect the iconic look of the legendary monster.The strong base and lightweight build make it easy to place on shelves, desks, or display cases without compromising stability.This isn’t just a toy — it’s a high- quality centerpiece built to impress collectors, fans, and design enthusiasts alike."
            },
            { image: "product2.png", text: "Powering the collectible is effortless with its reliable USB Type-C connection, supporting a standard 5V USB source. Once connected, the figure transforms with stunning multicolor spine lighting, creating a powerful ambient glow. Control is fully wireless through a dedicated companion app compatible with both iOS and Android devices. With seamless Bluetooth pairing, users can easily customize lighting effects, brightness, and modes to match their space and mood." },
            { image: "product2.png", text: "The toy is built with a water-resistant exterior, ensuring durability even in everyday environments. It’s recommended for ages 6 and above, as the figure contains small, sharp details designed to preserve the authentic look of Godzilla. When powered safely and handled with care, it delivers a premium, immersive display experience — a perfect fusion of artistry, technology, and nostalgia." }
        ],

        warrantyDetails:
            "We stand behind the quality of our product. This item is covered by a one-year limited warranty against manufacturing defects from the date of purchase. If your product exhibits a manufacturing fault during the warranty period, we will repair or replace it at our discretion — free of charge — after a quick inspection and proof of purchase. This warranty does not cover damage caused by misuse, accidental damage, improper power sources, unauthorized repairs, or normal wear and tear. For faster service, please contact our support team with your order number and photos of the issue; we’ll guide you through the replacement or repair process and clarify any shipping steps.",

        warnings: [
            "Contains small and sharp parts. Not suitable for children under 6 years. Adult supervision required.",
            "Use only a 5V USB Type-C power source. Do not use higher-voltage adapters or modified power supplies.",
            "Do not open, modify, or attempt to repair the product. Unauthorized disassembly voids warranty.",
            "Avoid immersion; not guaranteed waterproof for prolonged submersion.",
            "Stop using immediately if cable, connector, or housing is damaged.",
            "Charge only with certified adapters/cables. Supervise charging and keep away from flammable surfaces.",
            "Disconnect power before cleaning. Use a dry or lightly damp cloth only.",
            "Dispose of electronic components per local e-waste regulations.",
            "If you notice unusual heat, smoke, or smells, disconnect immediately and contact support."
        ],
        legalDisclaimer:
            "This product is intended for hobby and decorative use only. The seller is not liable for injury, damage, or misuse of the product. By purchasing, you acknowledge you’ve read and agreed to the safety instructions.",

        whatsInTheBox: [
            "1 × Godzilla Glow Edition Unit",
            "1 × USB Type-C Cable",
            "1 × Quick Start Guide",
            "1 × Warranty Card"
        ],

        powerSpecs: {
            voltage: "5V DC",
            current: "2A",
            connector: "USB Type-C",
            powerConsumption: "10W (max)"
        },
        appInfo: {
            name: "Godzilla Control App",
            ios: "iOS 13+",
            android: "Android 8+",
            pairing: "Enable Bluetooth, open the app, and tap 'Connect' to pair."
        },

        returnPolicy:
            "7-day replacement policy applicable only on manufacturing defects. No refunds on physical or power damage. Buyer is responsible for return shipping unless the product is faulty on arrival.",
        ageRestriction: "⚠️ Not suitable for children under 6 years of age. This is a collectible, not a toy.",
        careInstructions: [
            "Wipe gently with a dry cloth.",
            "Store indoors in a cool, dry place.",
            "Avoid direct sunlight for long periods.",
            "Do not immerse in water."
        ],
        certificationInfo:
            "This is a DIY collectible product designed for decorative use. Not BIS or CE certified. Complies with basic USB 5V handling standards.",

        reviews: [
            { user: "Sana", rating: 5, comment: "The glow effect is superb. Looks amazing at night!", images: ["product2.png"] },
            { user: "Rohit", rating: 4, comment: "Quality is great. Delivery was fast.", images: [] }
        ],

        features: [
            { icon: "Category", text: "Made with high-quality PLA for a durable and smooth finish." },
            { icon: "LightMode", text: "Built-in glow lighting system with easy control." },
            { icon: "Power", text: "Powered via universal Type-C connector." },
            { icon: "Bluetooth", text: "Wireless control with Bluetooth." }
        ],
        services: [
            "UPI / Debit / Credit Cards Accepted",
            "2 Year Warranty",
            "7 Days Replacement"
        ],

        price: "₹2,999",
        originalPrice: "₹4,499",
        discount: "33% OFF",
        rating: "4.8",
        totalReviews: "150"
    },

    {
        key: "product3",
        title: "Godzilla Neon Green",
        images: ["product3.png", "product3.png", "product3.png"],
        video: "/assets/product-video.mp4",
        stock: false,
        productDescription: [
            {
                image: "product3.png", text: "This Godzilla collectible is crafted with premium - grade PLA material, designed to deliver a smooth, durable, and finely detailed finish.Every scale, spike, and curve is sculpted to reflect the iconic look of the legendary monster.The strong base and lightweight build make it easy to place on shelves, desks, or display cases without compromising stability.This isn’t just a toy — it’s a high- quality centerpiece built to impress collectors, fans, and design enthusiasts alike."
            },
            { image: "product3.png", text: "Powering the collectible is effortless with its reliable USB Type-C connection, supporting a standard 5V USB source. Once connected, the figure transforms with stunning multicolor spine lighting, creating a powerful ambient glow. Control is fully wireless through a dedicated companion app compatible with both iOS and Android devices. With seamless Bluetooth pairing, users can easily customize lighting effects, brightness, and modes to match their space and mood." },
            { image: "product3.png", text: "The toy is built with a water-resistant exterior, ensuring durability even in everyday environments. It’s recommended for ages 6 and above, as the figure contains small, sharp details designed to preserve the authentic look of Godzilla. When powered safely and handled with care, it delivers a premium, immersive display experience — a perfect fusion of artistry, technology, and nostalgia." }
        ],

        warrantyDetails:
            "We stand behind the quality of our product. This item is covered by a one-year limited warranty against manufacturing defects from the date of purchase. If your product exhibits a manufacturing fault during the warranty period, we will repair or replace it at our discretion — free of charge — after a quick inspection and proof of purchase. This warranty does not cover damage caused by misuse, accidental damage, improper power sources, unauthorized repairs, or normal wear and tear. For faster service, please contact our support team with your order number and photos of the issue; we’ll guide you through the replacement or repair process and clarify any shipping steps.",

        warnings: [
            "Contains small and sharp parts. Not suitable for children under 6 years. Adult supervision required.",
            "Use only a 5V USB Type-C power source. Do not use higher-voltage adapters or modified power supplies.",
            "Do not open, modify, or attempt to repair the product. Unauthorized disassembly voids warranty.",
            "Avoid immersion; not guaranteed waterproof for prolonged submersion.",
            "Stop using immediately if cable, connector, or housing is damaged.",
            "Charge only with certified adapters/cables. Supervise charging and keep away from flammable surfaces.",
            "Disconnect power before cleaning. Use a dry or lightly damp cloth only.",
            "Dispose of electronic components per local e-waste regulations.",
            "If you notice unusual heat, smoke, or smells, disconnect immediately and contact support."
        ],
        legalDisclaimer:
            "This product is intended for hobby and decorative use only. The seller is not liable for injury, damage, or misuse of the product. By purchasing, you acknowledge you’ve read and agreed to the safety instructions.",

        whatsInTheBox: [
            "1 × Godzilla Neon Green Unit",
            "1 × USB Type-C Cable",
            "1 × Quick Start Guide",
            "1 × Warranty Card"
        ],

        powerSpecs: {
            voltage: "5V DC",
            current: "2A",
            connector: "USB Type-C",
            powerConsumption: "10W (max)"
        },
        appInfo: {
            name: "Godzilla Control App",
            ios: "iOS 13+",
            android: "Android 8+",
            pairing: "Enable Bluetooth, open the app, and tap 'Connect' to pair."
        },

        returnPolicy:
            "7-day replacement policy applicable only on manufacturing defects. No refunds on physical or power damage. Buyer is responsible for return shipping unless the product is faulty on arrival.",
        ageRestriction: "⚠️ Not suitable for children under 6 years of age. This is a collectible, not a toy.",
        careInstructions: [
            "Wipe gently with a dry cloth.",
            "Store indoors in a cool, dry place.",
            "Avoid direct sunlight for long periods.",
            "Do not immerse in water."
        ],
        certificationInfo:
            "This is a DIY collectible product designed for decorative use. Not BIS or CE certified. Complies with basic USB 5V handling standards.",

        reviews: [
            { user: "Manoj", rating: 5, comment: "Absolutely stunning piece. Neon pop looks sick.", images: ["product3.png"] },
            { user: "Priya", rating: 4, comment: "Loved it. Just wish stock comes back soon.", images: [] }
        ],

        features: [
            { icon: "Category", text: "Made with high-quality PLA for a durable and smooth finish." },
            { icon: "LightMode", text: "Vibrant neon finish enhances display aesthetics." },
            { icon: "Power", text: "Type-C powered lighting system." },
            { icon: "Bluetooth", text: "Wireless control via Bluetooth." }
        ],
        services: [
            "UPI / Debit / Credit Cards Accepted",
            "2 Year Warranty",
            "7 Days Replacement"
        ],

        price: "₹2,799",
        originalPrice: "₹3,999",
        discount: "30% OFF",
        rating: "4.6",
        totalReviews: "175"
    }
];

await Product.insertMany(product);
console.log("✅ Product inserted");
process.exit();
