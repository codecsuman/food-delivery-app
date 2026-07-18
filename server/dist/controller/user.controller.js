import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { uploadImage, deleteImage, getPublicIdFromUrl, } from "../utils/cloudinary.js";
import { generateToken, clearToken } from "../utils/generateToken.js";
import { sendPasswordResetEmail, sendResetSuccessEmail, sendWelcomeEmail, } from "../mailtrap/email.js";
// ======================= SIGNUP =======================
export const signup = async (req, res) => {
    try {
        const { fullname, email, password, contact } = req.body;
        if (!fullname || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Fullname, email and password are required",
            });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
            contact: contact ? Number(contact) : null,
            isVerified: true,
            admin: true,
        });
        generateToken(res, user);
        try {
            await sendWelcomeEmail(email, fullname);
        }
        catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
        }
        const userWithoutPassword = await User.findById(user._id).select("-password");
        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            user: userWithoutPassword,
        });
    }
    catch (error) {
        console.error("Signup error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= LOGIN =======================
export const login = async (req, res) => {
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
        const userWithoutPassword = await User.findById(user._id).select("-password");
        return res.status(200).json({
            success: true,
            message: `Welcome back ${user.fullname}`,
            user: userWithoutPassword,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= VERIFY EMAIL =======================
export const verifyEmail = async (req, res) => {
    try {
        const { verificationCode } = req.body;
        if (!verificationCode) {
            return res.status(400).json({
                success: false,
                message: "Verification code is required",
            });
        }
        const user = await User.findOne({
            verificationToken: verificationCode,
            verificationTokenExpiresAt: { $gt: Date.now() },
        }).select("-password");
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired verification token",
            });
        }
        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiresAt = undefined;
        await user.save();
        await sendWelcomeEmail(user.email, user.fullname);
        return res.status(200).json({
            success: true,
            message: "Email verified successfully",
            user,
        });
    }
    catch (error) {
        console.error("Verify email error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= LOGOUT =======================
export const logout = async (_req, res) => {
    try {
        clearToken(res);
        return res.status(200).json({
            success: true,
            message: "Logged out successfully",
        });
    }
    catch (error) {
        console.error("Logout error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= FORGOT PASSWORD =======================
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If an account exists for this email, a reset link has been sent",
            });
        }
        const resetToken = crypto.randomBytes(40).toString("hex");
        const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
        user.resetPasswordToken = resetToken;
        user.resetPasswordTokenExpiresAt = resetTokenExpiresAt;
        await user.save();
        await sendPasswordResetEmail(user.email, `${process.env.FRONTEND_URL}/reset-password/${resetToken}`);
        return res.status(200).json({
            success: true,
            message: "If an account exists for this email, a reset link has been sent",
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= RESET PASSWORD =======================
export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordTokenExpiresAt: { $gt: Date.now() },
        });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired reset token",
            });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordTokenExpiresAt = undefined;
        await user.save();
        await sendResetSuccessEmail(user.email);
        return res.status(200).json({
            success: true,
            message: "Password reset successfully",
        });
    }
    catch (error) {
        console.error("Reset password error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= CHECK AUTH =======================
export const checkAuth = async (req, res) => {
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
    }
    catch (error) {
        console.error("Check auth error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= GET PROFILE =======================
export const getProfile = async (req, res) => {
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
    }
    catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
// ======================= UPDATE PROFILE =======================
export const updateProfile = async (req, res) => {
    try {
        const userId = req.id;
        const { fullname, email, contact, address, city, country, profilePicture } = req.body;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Email already in use by another account",
                });
            }
        }
        const updateData = {};
        if (fullname !== undefined)
            updateData.fullname = fullname.trim();
        if (email !== undefined)
            updateData.email = email.toLowerCase().trim();
        if (contact !== undefined)
            updateData.contact = contact ? Number(contact) : null;
        if (address !== undefined)
            updateData.address = address.trim();
        if (city !== undefined)
            updateData.city = city.trim();
        if (country !== undefined)
            updateData.country = country.trim();
        if (profilePicture && typeof profilePicture === "string") {
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
            const cloudResponse = await uploadImage(profilePicture, "suman-food/avatars");
            updateData.profilePicture = cloudResponse.secure_url;
        }
        const updatedUser = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select("-password");
        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser,
        });
    }
    catch (error) {
        console.error("Update profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
//# sourceMappingURL=user.controller.js.map