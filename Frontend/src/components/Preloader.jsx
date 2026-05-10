import React, { useState, useEffect } from 'react';
import Spline from '@splinetool/react-spline';
import { motion, AnimatePresence } from 'framer-motion';

export default function Preloader({ isLoading, onRobotLoad }) {
    const letters = "LEGALAI".split("");



    const containerVariants = {
        visible: { transition: { staggerChildren: 0.15, delayChildren: 0.5 } }
    };

    const letterVariants = {
        hidden: { y: 80, opacity: 0, scale: 0.5 },
        visible: {
            y: 0, opacity: 1, scale: 1,
            transition: { type: "spring", damping: 12, stiffness: 100 }
        }
    };

    return (
        <div className={`fixed inset-0 z-[9999] bg-[#020202] flex flex-col items-center justify-center transition-all duration-1000 overflow-hidden ${isLoading ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>



            {/* 1. ROBOT 3D (Trung tâm của Portal) */}
            <div className="relative w-full max-w-3xl h-[280px] sm:h-[320px] md:h-[380px] lg:h-[450px] flex justify-center items-center z-10 drop-shadow-[0_0_50px_rgba(34,211,238,0.2)]">
                <Spline scene="https://prod.spline.design/dMx4Jy6SuNlBOCdL/scene.splinecode" onLoad={onRobotLoad} />
            </div>

            {/* 2. TYPOGRAPHY "LẮP CHỮ" */}
            <div className="w-full flex justify-center -mt-[4vw] sm:-mt-[3.5vw] md:-mt-[3vw] lg:-mt-[2.5vw] z-20 px-4">
                <svg viewBox="0 0 800 200" className="w-full max-w-5xl">
                    <motion.g variants={containerVariants} initial="hidden" animate={isLoading ? "visible" : "hidden"}>
                        {letters.map((char, index) => (
                            <motion.text
                                key={index}
                                variants={letterVariants}
                                x={400 + (index - 3) * 75}
                                y="100"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="none"
                                stroke={index > 4 ? "#22d3ee" : "#ffffff"}
                                strokeWidth="2"
                                className={index > 4 ? "glow-cyan" : "glow-white"}
                                style={{
                                    fontSize: '110px',
                                    fontWeight: '900',
                                    fontFamily: 'Inter, sans-serif',
                                    strokeDasharray: '500',
                                    strokeDashoffset: '500',
                                }}
                            >
                                {char}
                            </motion.text>
                        ))}
                    </motion.g>
                </svg>
            </div>

            {/* CSS BỔ SUNG CHO HIỆU ỨNG PORTAL */}
            <style>
                {`
                    @keyframes spin-slow {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes reverse-spin {
                        from { transform: rotate(360deg); }
                        to { transform: rotate(0deg); }
                    }
                    .animate-spin-slow {
                        animation: spin-slow 15s linear infinite;
                    }
                    .animate-reverse-spin {
                        animation: reverse-spin 10s linear infinite;
                    }
                    @keyframes drawStroke { to { stroke-dashoffset: 0; } }
                    .glow-white, .glow-cyan { animation: drawStroke 2s ease-out forwards; }
                    .glow-white { filter: drop-shadow(0 0 10px #fff); }
                    .glow-cyan { filter: drop-shadow(0 0 15px #22d3ee); }
                `}
            </style>
        </div>
    );
}