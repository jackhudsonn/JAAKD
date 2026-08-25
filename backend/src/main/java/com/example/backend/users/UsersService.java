package com.example.backend.users;

import org.springframework.stereotype.Service;

@Service
public class UsersService {

    public String ping() {
        return "ok - users service";
    }
}