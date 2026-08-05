package com.rnave.studily.user;

public class AvatarUrls {

    public static String of(User u) {
        if (u.getAvatarImage() == null || u.getAvatarKey() == null) {
            return null;
        }
        return "/api/users/" + u.getId() + "/avatar?k=" + u.getAvatarKey();
    }
}
