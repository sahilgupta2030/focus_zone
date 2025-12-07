// message.validators.js
import { z } from "zod";


// MongoDB ObjectId validator
export const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

// Text message body
export const messageContentSchema = z.object({
    content: z.string().min(1, "Message cannot be empty"),
    cardId: objectIdSchema.optional(), // only used in sendMessage
    workspaceId: objectIdSchema.optional(),
});


export const sendMessageSchema = z.object({
    body: z.object({
        content: z.string().min(1),
        cardId: objectIdSchema,
    }),
});

export const sendMediaMessageSchema = z.object({
    body: z.object({
        cardId: objectIdSchema.optional(),
        workspaceId: objectIdSchema.optional(),
    }),
    file: z.any().optional(), // multer attaches file
});


export const replyToMessageSchema = z.object({
    params: z.object({
        messageId: objectIdSchema,
    }),
    body: z.object({
        content: z.string().min(1),
    }),
});


export const editMessageSchema = z.object({
    params: z.object({
        messageId: objectIdSchema,
    }),
    body: z.object({
        content: z.string().min(1),
    }),
});


export const deleteMessageSchema = z.object({
    params: z.object({
        messageId: objectIdSchema,
    }),
});


export const getMessagesByCardSchema = z.object({
    params: z.object({
        cardId: objectIdSchema,
    }),
});

export const getMessagesByWorkspaceSchema = z.object({
    params: z.object({
        workspaceId: objectIdSchema,
    }),
});

export const getMessageByIdSchema = z.object({
    params: z.object({
        messageId: objectIdSchema,
    }),
});


export const searchMessagesSchema = z.object({
    params: z.object({
        workspaceId: objectIdSchema,
    }),
    query: z.object({
        q: z.string().min(1),
    }),
});


export const getMessagesWithPaginationSchema = z.object({
    params: z.object({
        cardId: objectIdSchema,
    }),
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be a number").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be a number").optional(),
    }),
});

export const getRecentMessagesSchema = z.object({
    params: z.object({
        cardId: objectIdSchema,
    }),
});


export const markMessageAsReadSchema = z.object({
    params: z.object({
        messageId: objectIdSchema,
    }),
});

export const markAllMessagesAsReadSchema = z.object({
    params: z.object({
        cardId: objectIdSchema,
    }),
});

export const getUnreadMessagesCountSchema = z.object({
    params: z.object({
        cardId: objectIdSchema,
    }),
});


export const typingStartSchema = z.object({
    body: z.object({
        workspaceId: objectIdSchema.optional(),
        cardId: objectIdSchema.optional(),
    }),
});

export const typingStopSchema = typingStartSchema;