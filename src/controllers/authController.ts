import type { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import prisma from '../prisma.js'
import { generateToken } from '../utils/auth.js'

export const loginAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const admin = await prisma.admin.findUnique({ where: { email } })

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, admin.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = generateToken(admin.id, 'admin')

    res.json({
      token,
      user: {
        id: admin.id,
        email: admin.email,
        type: 'admin'
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const loginBusiness = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const business = await prisma.business.findUnique({ where: { email } })

    if (!business) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const isValidPassword = await bcrypt.compare(password, business.password)

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = generateToken(business.id, 'business')

    res.json({
      token,
      user: {
        id: business.id,
        email: business.email,
        name: business.name,
        type: 'business'
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const registerBusiness = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' })
    }

    const existingBusiness = await prisma.business.findUnique({ where: { email } })

    if (existingBusiness) {
      return res.status(400).json({ error: 'Email already registered' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const business = await prisma.business.create({
      data: {
        email,
        password: hashedPassword,
        name
      }
    })

    const token = generateToken(business.id, 'business')

    res.status(201).json({
      token,
      user: {
        id: business.id,
        email: business.email,
        name: business.name,
        type: 'business'
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}
