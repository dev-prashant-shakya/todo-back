import e from "express";
import { collectionName, connection } from "./dbconfig.js";
import cors from "cors";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const app = e();

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://2dokeeper.netlify.app"
    ],
    credentials: true
}));
app.use(e.json());
app.use(cookieParser());

// Shared cookie options
const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 5 * 24 * 60 * 60 * 1000 // 5 days
};


app.post('/login', async(req, res) => {
    try {
        const {email, password} = req.body;
        if (email && password) {
            const db = await connection();
            const collection = db.collection("users");
            const user = await collection.findOne({ email, password });

            if(user) {
                jwt.sign({ email, password }, JWT_SECRET, {expiresIn: '5d'}, (err, token) => {
                    if (err) {
                        console.error("JWT sign error:", err);
                        return res.status(500).send({ success: false, message: "Internal server error" });
                    }
                    res.cookie('token', token, cookieOptions);
                    res.send({
                        success: true,
                        message: "Login successful"
                    })
                });
            } else {
                res.send({
                    success: false,
                    message: "Invalid email or password"
                })
            }
        } else {
            res.status(400).send({ success: false, message: "Email and password are required" });
        }
    } catch (error) {
        console.error("Error in /login:", error);
        res.status(500).send({ success: false, message: "Internal server error", error: error.message });
    }
})


app.post('/signup', async (req, res) => {
    try {
        const userData = req.body;

        if(userData.email && userData.password) {
            const db = await connection();
            const collection = db.collection("users");
            const result = await collection.insertOne(userData);
            if (result) {
                jwt.sign(userData, JWT_SECRET, {expiresIn: '5d'}, (err, token) => {
                    if (err) {
                        console.error("JWT sign error:", err);
                        return res.status(500).send({ success: false, message: "Internal server error" });
                    }
                    res.cookie('token', token, cookieOptions);
                    res.send({
                        success: true,
                        message: "Signup successful"
                    })
                });
            } else {
                console.error("Error inserting user data:", result);
                res.status(500).send({ success: false, message: "Failed to create account" });
            }
        } else {
            res.status(400).send({ success: false, message: "Email and password are required" });
        }
    } catch (error) {
        console.error("Error in /signup:", error);
        res.status(500).send({ success: false, message: "Internal server error", error: error.message });
    }
});

app.post("/add-task", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        const collection = db.collection(collectionName);
        const taskWithUser = { ...req.body, userEmail: req.userEmail };
        const result = await collection.insertOne(taskWithUser);
        if (result) {
            res.send({
                message: "new task added",
                success: true,
                result
            })
        } else {
            res.send({
                message: "task not added",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /add-task:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
})

app.get("/tasks", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        console.log("cookies:", req.cookies['token']);
        const collection = db.collection(collectionName);
        const result = await collection.find({ userEmail: req.userEmail }).toArray();
        if (result) {
            res.send({
                message: "Task list fetched",
                success: true,
                result
            })
        } else {
            res.send({
                message: "Error fetching task list",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /tasks:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
});

app.put("/update-task", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        const collection = db.collection(collectionName);
        const { _id, ...fields } = req.body;
        const update = { $set: fields };
        const result = await collection.updateOne({ _id: new ObjectId(_id), userEmail: req.userEmail }, update);
        if (result) {
            res.send({
                message: "Task updated",
                success: true,
                result
            })
        } else {
            res.send({
                message: "Task not updated",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /update-task:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
});

app.get("/task/:id", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        const collection = db.collection(collectionName);
        const result = await collection.findOne({ _id: new ObjectId(req.params.id), userEmail: req.userEmail });
        if (result) {
            res.send({
                message: "Task fetched",
                success: true,
                result
            })
        } else {
            res.send({
                message: "Error fetching task",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /task/:id:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
})

app.put("/completed/:id", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        const collection = db.collection(collectionName);
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id), userEmail: req.userEmail },
            { $set: { completed: true } }
        );
        if (result) {
            res.send({
                message: "Task marked as completed",
                success: true,
                result
            })
        } else {
            res.send({
                message: "Error marking task as completed",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /completed/:id:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
});

app.delete("/delete/:id", verifyJwtToken, async (req, res) => {
    try {
        const db = await connection();
        const collection = db.collection(collectionName);
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id), userEmail: req.userEmail });
        if (result) {
            res.send({
                message: "Task Deleted",
                success: true,
                result
            })
        } else {
            res.send({
                message: "Error deleting task",
                success: false,
                result
            })
        }
    } catch (error) {
        console.error("Error in /delete/:id:", error);
        res.status(500).send({
            message: "Internal server error",
            success: false,
            error: error.message
        })
    }
})

app.delete("/delete-multiple", verifyJwtToken, async (req, res) => {
    try {
        const { ids } = req.body;

        console.log("Received delete-multiple request with IDs:", ids);

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({
                success: false,
                message: "No task IDs provided",
            });
        }

        const db = await connection();
        const collection = db.collection(collectionName);
        
        // Convert string IDs to ObjectIds
        const deleteTaskIds = ids.map(id => new ObjectId(id));
        
        console.log("Deleting tasks with ObjectIds:", deleteTaskIds);

        // Perform the delete operation
        const result = await collection.deleteMany({
            _id: { $in: deleteTaskIds },
            userEmail: req.userEmail
        });

        console.log("Delete result:", result);

        res.send({
            success: true,
            message: `${result.deletedCount} task(s) deleted`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        console.error("Error in /delete-multiple:", error);
        res.status(500).send({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
});


app.get("/", (req, res) => {
    res.send({
        message: "Backend is Working",
        success: true
    })
})

// Verify token endpoint for protected routes
app.get("/verify-token", (req, res) => {
    const token = req.cookies["token"];
    
    if (!token) {
        return res.send({
            success: false,
            message: "No token provided"
        });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.send({
                success: false,
                message: "Invalid token"
            });
        }
        res.send({
            success: true,
            user: { email: decoded.email }
        });
    });
})

// Logout endpoint to clear the cookie
app.post("/logout", (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax'
    });
    res.send({
        success: true,
        message: "Logged out successfully"
    });
})

function verifyJwtToken(req, res, next) {
    console.log("verifyJwtToken", req.cookies["token"]);
    const token = req.cookies["token"];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if(err) {
            console.error("JWT verification error:", err);
            return res.status(401).send({
                success: false,
                message: "Unauthorized"
            });
        }
        req.userEmail = decoded.email;
        next();
        console.log("Decoded JWT:", decoded);
    });
}

app.listen(3200, () => {
    console.log("Server is running on port 3200");
});
