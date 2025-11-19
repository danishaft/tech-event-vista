'use client'

import { useState, useEffect } from 'react'

export function Interactive3D() {
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to 0-1 range
      const x = e.clientX / window.innerWidth
      const y = e.clientY / window.innerHeight
      setMousePosition({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // Calculate rotation based on mouse position
  const rotateX = (mousePosition.y - 0.5) * 20 // -10 to 10 degrees
  const rotateY = (mousePosition.x - 0.5) * -20 // -10 to 10 degrees

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none opacity-30 overflow-hidden">
      {/* 3D Cube using CSS transforms */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transformStyle: 'preserve-3d',
          transition: 'transform 0.1s ease-out',
        }}
      >
        {/* Front face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'translateZ(80px)',
            background: 'linear-gradient(135deg, #F31A7C, #3659E3)',
            borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(243, 26, 124, 0.3)',
          }}
        />
        
        {/* Back face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'translateZ(-80px) rotateY(180deg)',
            background: 'linear-gradient(135deg, #3659E3, #F31A7C)',
            borderRadius: '1rem',
            boxShadow: '0 20px 60px rgba(54, 89, 227, 0.3)',
          }}
        />
        
        {/* Right face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'rotateY(90deg) translateZ(80px)',
            background: 'linear-gradient(135deg, #F31A7C, #F31A7C)',
            borderRadius: '1rem',
            opacity: 0.8,
          }}
        />
        
        {/* Left face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'rotateY(-90deg) translateZ(80px)',
            background: 'linear-gradient(135deg, #3659E3, #3659E3)',
            borderRadius: '1rem',
            opacity: 0.8,
          }}
        />
        
        {/* Top face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'rotateX(90deg) translateZ(80px)',
            background: 'linear-gradient(135deg, #F31A7C, #3659E3)',
            borderRadius: '1rem',
            opacity: 0.6,
          }}
        />
        
        {/* Bottom face */}
        <div
          className="absolute w-32 h-32 md:w-40 md:h-40"
          style={{
            transform: 'rotateX(-90deg) translateZ(80px)',
            background: 'linear-gradient(135deg, #3659E3, #F31A7C)',
            borderRadius: '1rem',
            opacity: 0.6,
          }}
        />
      </div>

      {/* Floating particles using CSS */}
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 2 === 0 ? '#F31A7C' : '#3659E3',
            opacity: Math.random() * 0.5 + 0.3,
            animation: `float ${Math.random() * 3 + 2}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 2}s`,
          }}
        />
      ))}

      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
      `}</style>
    </div>
  )
}

