package com.rnave.studily;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class StudilyApplication {

    public static void main(String[] args) {
        SpringApplication.run(StudilyApplication.class, args);
    }

}
