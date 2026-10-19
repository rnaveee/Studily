package com.rnave.studily.user;

public class AvatarUrls {

    public static String of(User u) {
        if (u.getAvatarImage() == null || u.getAvatarKey() == null) {
            return null;
        }
        return of(u.getId(), u.getAvatarKey());
    }

    public static String of(Long id, String key) {
        if (id == null || key == null) {
            return null;
        }
        return "/api/users/" + id + "/avatar?k=" + key;
    }
}
