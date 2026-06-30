package com.rnave.studily.classmate;

import com.rnave.studily.classmate.ClassmateDtos.ClassmateSuggestion;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/classmates")
public class ClassmateController {

    private final ClassmateService classmateService;

    public ClassmateController(ClassmateService classmateService) {
        this.classmateService = classmateService;
    }

    @GetMapping("/suggestions")
    public List<ClassmateSuggestion> suggestions() {
        return classmateService.suggestions();
    }
}
