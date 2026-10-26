import { Request, Response } from "express";
import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { uploadImage, deleteImage, getPublicIdFromUrl } from "../utils/cloudinary.js";
import { generateToken, clearToken } from "../utils/generateToken.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ======================= SIGNUP =======================
export const signup = async (req: Request, res: Response) => {
  try {
    const { fullname, email, password, contact } = req.body;

    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Fullname, email and password are required",
      });
    }

    if (
      typeof fullname !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Fullname, email and password must be text",
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // `contact` may arrive as a number (JSON) or a string (form data). Reject
    // anything that is not a 10-digit number instead of persisting NaN or
    // letting Mongoose turn a validation problem into a 500.
    const contactNumber =
      contact === undefined || contact === null || contact === ""
        ? null
        : typeof contact === "string" || typeof contact === "number"
          ? Number(contact)
          : Number.NaN;

    if (
      contactNumber !== null &&
      (!Number.isInteger(contactNumber) ||
        !/^\d{10}$/.test(String(contactNumber)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Contact must be a valid 10-digit number",
      });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      fullname,
      email,
      password: hashedPassword,
      contact: contactNumber,
      isVerified: true,
      admin: false,
    });

    generateToken(res, user);

    const userWithoutPassword = await User.findById(user._id).select(
      "-password",
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: userWithoutPassword,
    });
  } catch (error: any) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= LOGIN =======================
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password +admin");
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    generateToken(res, user);

    user.lastLogin = new Date();
    await user.save();

    const userWithoutPassword = await User.findById(user._id).select(
      "-password",
    );

    return res.status(200).json({
      success: true,
      message: `Welcome back ${user.fullname}`,
      user: userWithoutPassword,
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= LOGOUT =======================
export const logout = async (_req: Request, res: Response) => {
  try {
    clearToken(res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= CHECK AUTH =======================
export const checkAuth = async (req: Request, res: Response) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET PROFILE =======================
export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.id;
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ======================= UPDATE PROFILE =======================
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = req.id;
    const { fullname, email, contact, alternateContact, address, pincode, city, state, country, latitude, longitude, profilePicture } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (email !== undefined) {
      const trimmedEmail = email.toLowerCase().trim();
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      if (trimmedEmail !== user.email) {
        const existingUser = await User.findOne({ email: trimmedEmail });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: "Email already in use by another account",
          });
        }
      }
    }

    const updateData: any = {};

    if (fullname !== undefined) updateData.fullname = fullname.trim();
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (contact !== undefined)
      updateData.contact = contact ? Number(contact) : null;
    if (alternateContact !== undefined)
      updateData.alternateContact = alternateContact ? Number(alternateContact) : null;
    if (address !== undefined) updateData.address = address.trim();
    if (pincode !== undefined) updateData.pincode = pincode.trim();
    if (city !== undefined) updateData.city = city.trim();
    if (state !== undefined) updateData.state = state.trim();
    if (country !== undefined) updateData.country = country.trim();
    if (latitude !== undefined)
      updateData.latitude = latitude === null ? null : Number(latitude);
    if (longitude !== undefined)
      updateData.longitude = longitude === null ? null : Number(longitude);

    if (profilePicture === "" || profilePicture === null) {
      // Explicitly clearing the avatar. Remove the old asset when possible.
      if (user.profilePicture) {
        const oldPublicId = getPublicIdFromUrl(user.profilePicture);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }
      updateData.profilePicture = "";
    } else if (profilePicture && typeof profilePicture === "string") {
      const isDataUri = profilePicture.startsWith("data:image/");
      const isUrl = /^https?:\/\//.test(profilePicture);

      if (!isDataUri && !isUrl) {
        return res.status(400).json({
          success: false,
          message: "Invalid profile picture format. Must be a data URI or URL",
        });
      }

      if (user.profilePicture) {
        const oldPublicId = getPublicIdFromUrl(user.profilePicture);
        if (oldPublicId) {
          await deleteImage(oldPublicId);
        }
      }

      const cloudResponse = await uploadImage(
        profilePicture,
        "suman-food/avatars",
      );
      updateData.profilePicture = cloudResponse.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true },
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error: any) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({
        success: false,
        message: "Email already in use by another account",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
